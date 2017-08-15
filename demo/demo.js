angular.module('some-app')
   .config(['QultoSearchProvider', function(QultoSearchProvider) {

      var idS = 'doSomeSearch';
      var idA = 'doAnotherSearch';

      var someSearchInstance = {
         url: 'get/some/:someId',
         paramDefaults: {someId: '@someId'}
      }

      var anotherSearchInstance = {
         url: 'get/another/'
      }


      QultoSearchProvider.addInstanceConfiguration(isS, someSearchInstance);
      QultoSearchProvider.addInstanceConfiguration(isA, anotherSearchInstance);
   }]);