# qulto-search

Angular search module.

Currently used by OPUSNET.

## The main purpose of this module

- Reduces the creation of angular $resource-s or maybe services in the projects
- With the registrated instances, the http requests are able to triggered everywhere
- Handles a search flow synchronously from the form submit to results display
- Provides an opportunity to create self made modules and use them in any way the developer want

## Current features

- Create search instances in config type with an id-url pair
- Registering and calling child directive components
- Handling the search flow, and locks the others until the response is displayed
- Provides a silent search function which is out of the previous flow, and can be handled the returned promise in another way
- Provides an option to dinamically change the http method type
- Provides event listener subscription for each step

If you are not interested in the specifications [jump to the usage](#usage)

Because the qulto search directive's controller is available in the link phase you can registrate your components here.
There isn't any condition that the registrated directive cannot be a multi component.
If it handles the search trigger, result display and query builder functionality it can be registrated as all of these types of components.

The required implementations of the components

- From: the object must implements a fillForm method
- Result view: the object must implements a showRecord or showRecords function
- Pre build module: the object must implements the beforeBuild function
- Post build module: the object must implements the afterBuild function
- Pre search module: the object must implements the beforeSearch function
- Post search module: the object must implements the afterSearch function

Search object

Because everyone create query objects in a different way, the module only requires a getQuery() function implementation in the object. It has to return with the object which is compatible with the actual $resource's params.

Optional features

- You can register reset functions for the components. Those are called one by one if any component call's the resetSearch()
- Custom query builder function. It's highly recommended, if you do not want to build a valid search object from the submitted form's data.
- You can extend your search object in the custom query builder with setSorting(), to search with another ordering and setPage() for paginated search.

## Usage

### Instance configurations

In config time you need to inject the provider and register the instances like this

```javascript
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
   }])
```

### Component registering

Every component can be registered by creating a require type directive:

```javascript
angular.module('some-app')
    .directive('searchComponent', qultoSearchComponent);

function qultoSearchComponent() {

    return {
        require: '^qultoSearch',
        link: function(scope, element, attributes, qultoSearchController) {
            // Register for something
        }
    }
}
```

### Activation, link

After that you can use it in your html

```html
<qulto-search instance="doSomeSearch" method="$get">
    <search-component></search-component>
</qulto-search>
```

### Parameters

- instance: String, required
- method: String, optional
  - $get
  - $query
  - $post (default)

Little help for understanding the directive's life cycle:
https://www.toptal.com/angular-js/angular-js-demystifying-directives