'use strict';

angular.module('semdomtrans.edit', ['jsonRpc', 'ui.bootstrap', 'bellows.services',  'ngAnimate', 'palaso.ui.notice', 'semdomtrans.services', 'palaso.ui.sd.term', 'palaso.ui.sd.questions', 'palaso.ui.scroll', 'palaso.ui.typeahead', 'palaso.ui.sd.ws'])
// DBE controller
.controller('editCtrl', ['$scope', '$state', '$stateParams', 'semdomtransEditService', 'semdomtransEditorDataService', 'sessionService', 'modalService', 'silNoticeService', '$rootScope', '$filter', '$timeout',
function($scope, $state, $stateParams, semdomEditApi, editorDataService, sessionService, modal, notice, $rootScope, $filter, $timeout) {
  
  // variable that determines which tab is selected
  $scope.selectedTab = 0;
  
  // control is set to scope (necessary for passing down to directives)
  $scope.control = $scope;
  
  // determines which question we are on in term
  $scope.currentQuestionPos = 0;
  
  /*
  $scope.tabDisplay = {"val": '0'};
  $scope.state = "edit"; 
  */
  $scope.displayedItems = [];
  $scope.selectedDepth = 1;
  $scope.searchText = "";
  $scope.isEditingWorkingSet = false;
  $scope.hideTranslated = false;
  $scope.hideDescription = false;
  $scope.hideSearchKeys = false;
  $scope.hideQuestionsTerms = false;
  $scope.includedItems = {};

  $scope.subDomain = "1";
  $scope.allSubDomains = [];
  
  var api = semdomEditApi;
   
  $scope.selectSubDomain = function(subDomain) {
    $scope.subDomain = subDomain;
    $scope.reloadItems($scope.selectedDepth);
  }
  
  /*
   * Calculates a list of all subdomains that have at least one item from the current working set in them
   * Then check if currently selected subdomain is in this list, if not set it to the first subdomain on list
   */
  function calculateSubdomainList() {
    var subDomainsDict = {};
    $scope.allSubDomains = [];
    for (var key in $scope.includedItems) {
      var sd = key[0];
      if (angular.isUndefined(subDomainsDict[sd]) || !subDomainsDict[sd]) {
        $scope.allSubDomains.push(sd);
        subDomainsDict[sd] = "true";
      }
    }
    
    // sort in case earlier subdomains were added later to working set
    $scope.allSubDomains.sort();
    
    if (angular.isUndefined(subDomainsDict[$scope.subDomain]) || !subDomainsDict[$scope.subDomain]) {
      $scope.subDomain = $scope.allSubDomains[0];
    }
  }
  
  /*
   * Reloads all items to be displayed based on the following filters:
   *    1) Depth of slider that determines to what depth of tree we want to see items
   *    2) Simple search filter - this is a regular angular filter, that filters items based on their content
   *    3) Working set - only show items or ancestors of items in a given working set
   *    4) Subdomain - we only display items of one top level domain at a time (e.g. "1", "2", ..., "9")
   */
  $scope.reloadItems = function reloadItems(depth, delay) {
     if (delay == undefined) {
       delay = 0;
     }
      var query = $scope.selectedText;
      $timeout(function() {        
            // ensures that we are not constantly reloading
            if (query != $scope.selectedText)
              return;            
            
            // reload working set of items
            if (!angular.isUndefined($scope.newWs)) {
              loadWorkingSetItems($scope.newWs);
            } else {
              loadWorkingSetItems($scope.workingSets[$scope.selectedWorkingSet]);
            }
            // calculate list of subdomains
            calculateSubdomainList();
           
            // list of all working set items
            var includedItemList = [];
            
            // ancestors of filtered items
            var ancestorsOfIncluded = [];
            
            // dictionary to keep track of items add 
            // (since it is possible for multiple items in a working set to have the same ancestors (e.g. 1.3 and 1.4 will have 1 as common ancestor
            //- so this would result in duplicates if we did not keep track of what has been added)
            var addedToFiltered = {};
            
            // get all actually included items
            for (var i in $scope.itemsTree) {
              var node = $scope.itemsTree[i];
              var item = node.content;
              if ($scope.isIncludedInWs(item.key) && item.key[0] == $scope.subDomain) {
                includedItemList.push(item);
              }              
            }          
          
            // apply filter       
            includedItemList = $filter('filter')(includedItemList, $scope.searchText);
            
            // reset included items dict to only include filtered items
            var includedItemsDict = {};
            for (var i in includedItemList) {
              includedItemsDict[includedItemList[i].key] = true;
            }
            
            $scope.includedItems = includedItemsDict;
                        
            // check off that items have been added (to avoid duplicates in next step)
            for (var i in includedItemList) {
              var item = includedItemList[i];
              addedToFiltered[item.key] = true;
            }
            
            // add ancestors of items in working set
            for (var i in includedItemList) {
              var node = $scope.itemsTree[includedItemList[i].key];
              var item = node.content;      
              if ($scope.isIncludedInWs(item.key) && item.key[0] == $scope.subDomain) {
                while(node.parent != '') {
                  if (angular.isUndefined(addedToFiltered[node.parent]) || !addedToFiltered[node.parent]) {
                    ancestorsOfIncluded.push($scope.itemsTree[node.parent].content);
                    addedToFiltered[node.parent] = true;
                  }
                  
                  node = $scope.itemsTree[node.parent];
                }
              }
            }            
            
            includedItemList = includedItemList.concat(ancestorsOfIncluded);
            
            var filteredByDepthItems = [];
            
            // process by depth
            for (var i in includedItemList) {
              if (checkDepth(includedItemList[i].key)) {
                filteredByDepthItems.push(includedItemList[i]);
              }
            }
            
            // check off that items have been added (to avoid duplicates in next step)
            for (var i in includedItemList) {
              var item = includedItemList[i];
              addedToFiltered[item.key] = true;
            }
            
            
            filteredByDepthItems.sort(function(a, b) {
              if (a.key < b.key) {
                return -1;
              } else {
                return 1;
              }
            });           
            
            $scope.displayedItems = filteredByDepthItems;
            if (!$scope.$$phase) {
              $scope.$apply()      
            }
          }, delay);
  }
  
  /*
   * Set items to be included 
   */
  $scope.setInclusion = function setInclusion(itemsToInclude, v) {
    for (var i in itemsToInclude) {
      $scope.includedItems[itemsToInclude[i].key] = v;
    }
    
    $scope.reloadItems($scope.selectedDepth);    
  }
  
  /*
   * Determines if a semdom item is completely approved (4 stands for approved)
   */
  
  function isItemCompletelyApproved(item) {
    var translated = true;
    translated = translated && (item.name.status == 4);
    translated = translated && (item.description.status == 4);
    for (var i = 0; i < item.searchKeys.length; i++) {
      translated = translated && (item.searchKeys[i].status == 4);
    }
    
    for (var i = 0; i < item.questions.length; i++) {
      translated = translated && (item.questions[i].question.status == 4);
      translated = translated && (item.questions[i].terms.status == 4);
    }
    
    return translated;
  }
  
  $scope.$watch('selectedDepth', function(newVal, oldVal) {
    if (oldVal != newVal) {
      var depth = newVal;
      $timeout(function() {
        if (depth == $scope.selectedDepth) {
            $scope.reloadItems(newVal);
        }
      }, 500);
    }
  });
  
  function checkDepth(key) {
    if ((key.length + 1) / 2 <= $scope.selectedDepth) {
      return true;
    }
    return false;
  }
  
  $scope.setTab = function(val) {
    $scope.selectedTab = val;
  }  
  
  $scope.changeTerm = function(key) {
      $scope.currentQuestionPos = 0;
      for (var i = 0; i < $scope.items.length; i++) {
        if ($scope.items[i].key == key) {
          $scope.currentEntry = $scope.items[i];
          $scope.currentEntryIndex = i;
          break;
        }
      }      
      $state.go("editor.editItem", { position: $scope.currentEntryIndex});
    }
  
  $scope.updateItem = function updateItem(v) {
    // update item if we hit the enter key
    v = (v === undefined) ? 13 : v;
    if (v == 13) {
      api.updateTerm($scope.currentEntry, function(result) {
        ;
      });
    }
  }
  
  $scope.refreshDbeData = function refreshDbeData(state) {
     return editorDataService.refreshEditorData().then(function(result) { 
       editorDataService.processEditorDto(result).then(function(resut) {
         ;
       })
     });
  };
    
  $scope.$watchCollection('items', function(newVal) {
    if (newVal && newVal.length > 0) {
      
      // reload all items up to appropriate tre depth
      var maxDepth = 0;
      for (var i in $scope.items) {
        var depth = ($scope.items[i].key.length + 1)/2;
        if (depth > maxDepth) {
          maxDepth = depth;
        }
        
        $scope.includedItems[$scope.items[i].key] = true;
      }
      
      $scope.maxDepth = maxDepth;
      
      // reload current entry if it is included in lsit
      if (!angular.isUndefined($stateParams.position) && $stateParams.position != null && $stateParams.position != "" && $scope.includedItems[$scope.items[$stateParams.position].key]) {      
        $scope.currentEntry = $scope.items[$stateParams.position];
        $scope.currentEntryIndex = angular.isUndefined($stateParams.position) ? 0 : $stateParams.position;
        $scope.changeTerm($scope.currentEntry.key);
      }
      
      $scope.currentEntry = $scope.items[$scope.currentEntryIndex];
      $scope.translatedItems = {};
      // find all items that are completely translated
      for (var i = 0; i < $scope.items.length; i++) {
        if (isItemCompletelyApproved($scope.items[i])) {
          $scope.translatedItems[$scope.items[i].key] = true;
        } else {
          $scope.translatedItems[$scope.items[i].key] = false;
        }
      }
    }   
  });
  
  /*
   * Handles changes when workingSets change - specifically if no selectedWorkingSet is defined
   * than set the default to 0, otherwise reload selectedWorkingSet
   */
  $scope.$watchCollection('workingSets', function(newVal) {
    if (newVal) {
      if (angular.isUndefined($scope.selectedWorkingSet)) {
        $scope.selectedWorkingSet = 0;
      }
      else {
        $scope.reloadItems($scope.selectedDepth);  
      }
    }
  });
  
  //search typeahead
  $scope.typeahead = {
    term: '',
    searchResults: []
  };
  
  /*
   * Function that takes as input a query and returns associated search results for typeahed
   */
  $scope.typeahead.searchEntries = function searchEntries(query) {
    // if query starts with number, include all items whose key begin with that number
    if (!isNaN(parseInt(query[0]))) {
      $scope.typeahead.searchResults = []
      var results = [];
      var ln = query.length;
      for (var i in $scope.items) {
        if ($scope.items[i].key.substring(0, ln) === query) {
          results.push($scope.items[i]);
        }
      }
      $scope.typeahead.searchResults = results; 
    } else {
      $scope.typeahead.searchResults = $filter('filter')($scope.items, query);
    }
  };

  /*
   * Neccessary to define this function for typeahead
   */
  $scope.typeahead.searchSelect = function searchSelect(entry) {
  }; 
  
  /*
   * Function that determinses if an item is included in our current working set
   */
  $scope.isIncludedInWs = function isIncludedInWs(key) {
    return !angular.isUndefined($scope.includedItems[key]) && $scope.includedItems[key] ;
  }
  
  /*
   * Set the appropriate working set to be edited
   */
  $scope.editWorkingSet = function editWorkingSet(wsID) {
    for (var i = 0; i < $scope.workingSets.length; i++) {
      if ($scope.workingSets[i].id == wsID) {
        $scope.selectedWorkingSet = i;
        $scope.isEditingWorkingSet = true;
        break;
      }
    }
  }
  
  /*
   * Cancels editing of working set, specifically
   * isEditingWorkingSet is set to false, and newWS is set back to undefined
   */
  $scope.cancelEditingWorkingSet = function cancelEditingWorkingSet(wsOriginal) {
    $scope.isEditingWorkingSet = false;
    if (!angular.isUndefined($scope.newWs)) {
      $scope.newWs = undefined;
    }
    $scope.reloadItems($scope.selectedDepth);  
  }

  /*
   * Creates a new empty working set and then loads it
   */
  $scope.createNewWorkingSet = function createNewWorkingSet() {    
    $scope.newWs = { id: '',  name: '', isShared : false, itemKeys : [] }   
    $scope.isEditingWorkingSet = true;
    $scope.reloadItems($scope.selectedDepth);  
  }
  
  /*
   * Handle change in selectedWorkingSet by loading working set
   */
  $scope.$watch("selectedWorkingSet", function(newVal, oldVal) {
    if (oldVal != newVal) {
      $scope.reloadItems($scope.selectedDepth);  
    }
  })
  
  function loadWorkingSetItems(ws) {
    $scope.includedItems = {};
    for (var i = 0; i < ws.itemKeys.length; i++) {
      $scope.includedItems[ws.itemKeys[i]] = true;
    }
  }  
  
  /*
   * Function that handles saving of working set:
   * 1) Pull all items from working set and insert them into an array
   * 2) Make call to updateWorkingSet on service
   * 3) Reset working set variables (
   */
  $scope.saveWorkingSet = function saveWorkingSet(ws) {
    var ik = [];
    for (var i in $scope.includedItems) {
      if ($scope.includedItems[i]) {
        ik.push(i);
      }
    }
    
    ws.itemKeys = ik;
    api.updateWorkingSet(ws, function(result) {
      if (result.ok) {
        
      }
    })
    $scope.isEditingWorkingSet = false;
    $scope.newWs = undefined;
    $scope.refreshDbeData();

  }
  
  $scope.isItemSelected = function isItemSelected() {
    return !angular.isUndefined($scope.currentEntryIndex);
  }
 
}]);
