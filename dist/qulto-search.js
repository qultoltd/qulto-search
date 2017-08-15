'use strict';

// AMD support
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module unless amdModuleId is set
    define([], function () {
      return (factory());
    });
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    factory();
  }
}(this, function () {
// AMD support

/**
 * Module initialization
 */
angular.module('qulto.search', []);


/**
 * Provider and search service instance factory initialization
 */
angular.module('qulto.search').provider('QultoSearch', QultoSearchProvider);

/* ### Search provider which creates the QultoSearchService ### */
function QultoSearchProvider() {

   var instanceConfigurations = {};

   // Add a search instance configuration
   this.addInstanceConfiguration = function(id, resourceConfigurations) {
      if (instanceConfigurations.hasOwnProperty(id)) {
         throw new Error('Multiple try to add configuration with this id: ' + id);
      }
      instanceConfigurations[id] = resourceConfigurations;
   }

   /**
    * This is the factory method wich will be called by the angular, which
    * provides the injectable search instance factory service
    */ 
   this.$get = ['$log', '$resource', function($log, $resource) {
      return new QultoSearchInstanceFactory($log, $resource, instanceConfigurations);
   }]
}

/* Search instance factory which builds the configured search instances */
function QultoSearchInstanceFactory($log, $resource, instanceConfigurations) {

   if (Object.keys(instanceConfigurations).length < 1) {
      throw new Error('The search service is not configured. Use "QultoSearchProvider" to add at least one instance configuration.');
   }

   var instances = {};

   for (var id in instanceConfigurations) {
      instances[id] = new SearchInstance(_buildResource(id, instanceConfigurations[id]));
   }

   var factory = {
      getSearchInstance : getSearchInstance
   }

   return factory;

   function getSearchInstance(id) {
      var instance = instances[id];
      if (!instance) {
         throw new Error('Search instance is not available for this id: ' + id);
      }
      return instance;
   }

   function _buildResource(id, resourceConfig) {

      if (!resourceConfig.url) {
         throw new Error('URL is missing. Id: ' + id);
      }

      if (!resourceConfig.paramDefaults) {
         $log.debug('The configuration param defaults is not defined. This can cause unexpected behavoir.' +  
            'Id: ' + id + ' URL: ' + config.url);
      }

      var paramDefaults = resourceConfig.paramDefaults || {};

      return $resource(resourceConfig.url, paramDefaults);
   }
}

/** A search instance which handle the actual resource requests **/
function SearchInstance(resource) {

   var $resource = resource;

   var service = {
      doGetSearch: doGetSearch,
      doQuerySearch: doQuerySearch,
      doPostSearch: doPostSearch
   }

   return service;
   
   function doGetSearch(searchObject) {
      return $resource.get(searchObject).$promise;
   }

   function doQuerySearch(searchObject) {
      return $resource.query(searchObject).$promise;
   }

   function doPostSearch(body, header) {
      var urlParams = header || {};

      return $resource.save(urlParams, body).$promise;
   }
}

/*** #### From here these are the search directives #### ***/
qultoSearchDirective.$inject = ['$q', '$log', '$timeout', 'QultoSearch'];

angular.module('qulto.search')
   .directive('qultoSearch', qultoSearchDirective);

function qultoSearchDirective($q, $log, $timeout, QultoSearch) {

   var initialization = $q.defer();

   return {
      restrict: 'E',
      scope: {
         instance: '@',
         method: '@?'
      },
      link: function(scope) {
         initialization.resolve();
      },
      transclude: true,
      template: '<div ng-transclude></div>',
      controller: ['$scope', function($scope) {

         if (!$scope.instance) {
            throw new Error('The search instance id must be defined!');
         }
         /**
          * Initialize
          */
         // Form and view
         var searchForm = null;
         var resultView = null;
         var recordView = null;

         // Query builder
         var queryBuilder = _noOpQueryBuilder;
         var searchInProgress = false;

         // Pre search and post search modules
         var modules = {
            preBuild: [],
            postBuild: [],
            preSearch: [],
            postSearch: []
         }

         var resets = [];

         // The search function by the method option
         var searchFunction = null;

         switch($scope.method) {
            case '$get':
               searchFunction = QultoSearch.getSearchInstance($scope.instance).doGetSearch;
               break;
            case '$query':
               searchFunction = QultoSearch.getSearchInstance($scope.instance).doQuerySearch;
               break;
            default:
               $log.debug('The method is not defined. Fallback to default -> $post');
               searchFunction = QultoSearch.getSearchInstance($scope.instance).doPostSearch;
               break;
         }

         var initialized = initialization.promise;
         // The last search, which will be used for paginating and orders 
         var lastSearch = null;
         
         /**
          * Registering block
          */

         // Register form
         this.registerSearchForm = function(form) {
            if (!angular.isFunction(form.fillForm)) {
               throw new Error('The form must implement the fill form method')
            }
            searchForm = form;
         }

         // Register result view
         this.registerResultView = function(view) {
            resultView = view;
         }

         // Register record view
         this.registerRecordView = function(view) {
            if (!angular.isFunction(view.showRecord) || !angular.isFunction(view.showRecords)) {
               throw new Error('The record view must implement "showRecord" and "shorRecords" functions');
            }
            recordView = view;
         }

         // Register custom query builder
         this.registerQueryBuilder = function(builder) {
            queryBuilder = builder;
         }

         // Register modules
         this.registerPreBuildModule = function(module) {
            if (!angular.isFunction(module.beforeBuild)) {
               throw new Error('Pre build module must define "beforeBuild" function');
            }
            modules.preBuild.push(module)
         }

         this.registerPostBuildModule = function(module) {
            if (!angular.isFunction(module.afterBuild)) {
               throw new Error('Post build module must define "afterBuild" function');
            }
            modules.postBuild.push(module)
         }

         this.registerPreSearchModule = function(module) {
            if (!angular.isFunction(module.beforeSearch)) {
               throw new Error('Pre search module must define "beforeSearch" function');
            }
            modules.preSearch.push(module)
         }

         this.registerPostSearchModule = function(module) {
            if (!angular.isFunction(module.afterSearch)) {
               throw new Error('Post search module must define "afterSearch" function');
            }
            modules.postSearch.push(module)
         }

         this.addReset = function(reset) {
            if (!angular.isFunction(reset)) {
               throw new Error('The reset must be a function');
            }
            resets.push(reset);
         }

         this.resetSearch = function() {
            for (var i = 0; i < resets.length; i++) {
               resets[i]();
            }
         }
 
         // Search
         this.search = function(searchObject) {
            initialized.then(
               function() {
                  if (queryBuilder === _noOpQueryBuilder) {
                     $log.warn('No specific query builder. Using noOpBuilder.')
                  }
                  searchInProgress = true;
                  // Build
                  _callPreBuildModules(searchObject);

                  var builtSearchObject = queryBuilder(searchObject);

                  _callPostBuildModules(builtSearchObject);
                  
                  lastSearch = angular.copy(builtSearchObject);

                  _doSearch(builtSearchObject);
               }
            )
         }

         this.silenceSearch = function(searchObject, success, error) {
            initialized.then(
               function() {
                  var builtSearchObject;
                  // Because it can be the same
                  if (searchObject.getQuery) {
                     builtSearchObject = searchObject;
                  } else {
                     builtSearchObject = queryBuilder(searchObject);
                  }
                  searchFunction(builtSearchObject.getQuery()).then(success, error);
               }
            )
         }

         this.fillForm = function(searchObject, additionalData) {
            if (searchForm) {
               searchForm.fillForm(searchObject, additionalData);
            }
         }

         // Page change -> works with the last search
         this.changePage = function(pageIndex, pageSize) {
            if (!lastSearch) {
               return;
            }
            if (!angular.isFunction(lastSearch.setPage)) {
               throw new Error('The search object does not implement the "setPage" function. Pagination is impossible.');
            }
            lastSearch.setPage(pageIndex, pageSize);
            _doSearch(lastSearch);
         }

         // Order by -> works with the last search
         this.changeShorting = function(shorting) {
            if (!lastSearch) {
               return;
            }
            if (!angular.isFunction(lastSearch.setSorting)) {
               throw new Error('The search object does not implement the "orderBy" function. Shorting is impossible.');
            }
            
            lastSearch.setSorting(shorting);
            _doSearch(lastSearch);
         }

         /**
          * Search functions, not available for child modules
          */
         function _callPreBuildModules(searchObject) {
            for (var i = 0; i < modules.preBuild.length; i++) {
               modules.preBuild[i].beforeBuild(searchObject);
            }
         }

         function _callPostBuildModules(builtObject) {
            for (var i = 0; i < modules.postBuild.length; i++) {
               modules.postBuild[i].afterBuild(builtObject);
            }
         }

         function _callPreSearchModules(searchObject) {
            for (var i = 0; i < modules.preSearch.length; i++) {
               modules.preSearch[i].beforeSearch(searchObject);
            }
         }

         function _callPostSearchModules(searchObject, result) {
            for (var i = 0; i < modules.postSearch.length; i++) {
               modules.postSearch[i].afterSearch(searchObject, result);
            }
         }

         function _doSearch(searchObject) {
            _callPreSearchModules(searchObject);

            var timeoutPromise = $timeout(function() {
               searchInProgress = false;
            }, 5000);

            searchFunction(searchObject.getQuery()).then(
               function(response) {
                  _callPostSearchModules(searchObject, response);
                  
                  if (!resultView || !angular.isFunction(resultView.setResult)) {
                     $log.error('The result view\'s "setResult" function is missing! Filling up skipped....');
                     return;
                  }
                  
                  resultView.setResult(response, searchObject.getQuery());
                  searchInProgress = false;
                  $timeout.cancel(timeoutPromise);
               }, function(error) {
                  searchInProgress = false;
                  $timeout.cancel(timeoutPromise);
               }
            )
         }

         // Show records
         this.showRecord = function(record) {
            if (!recordView) {
               $log.debug('Record view is not registered. Skipping...');
               return;
            }

            recordView.showRecord(record);
         }

         this.showRecords = function(records) {
            if (!recordView) {
               $log.debug('Record view is not registered. Skipping...');
               return;
            }

            recordView.showRecords(records);
         }

         function _noOpQueryBuilder (searchObject) {
            return searchObject;
         }
      }]
   }
   
}

angular.module('qulto.search')
   .directive('qultoSearchTrigger', qultoSearchTrigger);

function qultoSearchTrigger() {

   return {
      restrict: 'E',
      require: '^^qultoSearch',
      scope: {
         onTriggerReady: '&'
      },
      link: function($scope, element, attrs, qultoSearch) {

         var trigger = {
            search: function(searchObject) {
               qultoSearch.fillForm(searchObject);
               qultoSearch.search(searchObject);
            },
            silenceSearch: qultoSearch.silenceSearch
         }

         $scope.onTriggerReady({trigger: trigger});
      }
   }
}

}));