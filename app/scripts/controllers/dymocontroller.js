(function () {
	'use strict';

	angular.module('dymoDesigner.controllers')
		.controller('DymoController', ['$scope', '$http', function($scope, $http){
			
			var inputDir = 'input/';
			
			window.AudioContext = window.AudioContext || window.webkitAudioContext;
			$scope.audioContext = new AudioContext();
			
			$scope.store = new DymoStore(function() {
				init();
				initTest();
			});
			$scope.manager = new DymoManager($scope.audioContext, undefined, undefined, undefined, onPlaybackChange);
			$scope.generator = new DymoGenerator($scope.store, adjustViewConfig);
			
			$scope.viewConfig = {xAxis:createConfig("x-axis"), yAxis:createConfig("y-axis"), size:createConfig("size"), color:createConfig("color")};
			function createConfig(name) {
				return {name:name, param:$scope.generator.getFeatures()[1], log:false};
			}
			
			$scope.currentGraph = {"nodes":[], "edges":[]};
			$scope.urisOfPlayingDymos = [];
			
			function init() {
				updateRelations([HAS_PART, HAS_SIMILAR, HAS_SUCCESSOR]);
				setTimeout(function() {
					$scope.$apply();
				}, 10);
			}
			
			function updateRelations(uris) {
				$scope.relations = [];
				for (var i = 0; i < uris.length; i++) {
					$scope.relations.push({name:uris[i].slice(uris[i].lastIndexOf('#')+1), uri:uris[i]});
				}
				$scope.selectedRelation = $scope.relations[0];
			}
			
			function initTest() {
				var directory = 'input/fugue_m4a/';//'input/25435__insinger__free-jazz-text_wav/'
				var filename = 'fugue.m4a';//'25435__insinger__free-jazz-text.wav'
				Benchmarker.startTask("getFiles")
				$http.get('getfeaturefilesindir/', {params:{directory:directory}}).success(function(featureFiles) {
					addDymo(directory, filename, featureFiles, function() {
						$scope.manager.loadDymoAndRenderingFromStore($scope.store, function() {
							$scope.updateGraph();
						});
					})
				});
			}
			
			/*$http.get('getfoldersindir/', {params:{directory:inputDir}}).success(function(folders) {
				$scope.inputFolders = folders;
				$scope.selectedFolder = folders[0];
				$scope.sourceSelected();
			});
			
			$scope.sourceSelected = function() {
				//$scope.scheduler.addSourceFile($scope.selectedSource);
				if ($scope.generator.getDymoGraph().nodes.length > 0) {
					$scope.generator.setAudioFileChanged();
				}
				$http.get('getfeaturefilesindir/', {params:{directory:inputDir+$scope.selectedFolder}}).success(function(data) {
					$scope.featureFiles = data;
					$scope.selectedFeature = data[0];
				});
			}*/
			
			function addDymo(directory, sourceFile, featureFiles, callback) {
				var orderedFiles = [];
				var subsetConditions = [];
				for (var i = 0; i < $scope.availableFeatures.length; i++) {
					if ($scope.availableFeatures[i].selected) {
						var currentFeatureFile = featureFiles.filter(function(f){return f.indexOf($scope.availableFeatures[i].name) >= 0;})[0];
						if (currentFeatureFile) {
							orderedFiles.push(currentFeatureFile);
							subsetConditions.push($scope.availableFeatures[i].subset);
						}
					}
				}
				orderedFiles = orderedFiles.map(function(f){return directory+f});
				DymoTemplates.createSimilaritySuccessorDymoFromFeatures($scope.generator, directory+sourceFile, orderedFiles, subsetConditions, function() {
					callback();
				});
			}
			
			$scope.fileDropped = function(file) {
				postAudioFile(file, function() {
					var directory = 'input/'+file.name.replace(/\./g,'_')+'/'; 
					//var directory = 'input/25435__insinger__free-jazz-text_wav/'
					$http.get('getfeaturefilesindir/', {params:{directory:directory}}).success(function(featureFiles) {
						addDymo(directory, file.name, featureFiles, function() {
							$scope.manager.loadDymoAndRenderingFromStore($scope.store, function() {
								
							});
						})
					});
				});
			}
			
			$scope.addDymo = function() {
				/*var selectedSourceName = $scope.selectedSource.split('.')[0];
				var uris = [];
				uris[0] = featureFilesDir + selectedSourceName + '_barbeat.json';
				uris[1] = featureFilesDir + selectedSourceName + '_amplitude.json';
				uris[2] = featureFilesDir + selectedSourceName + '_centroid.json';
				$scope.generator.setCondensationMode($scope.selectedFeatureMode.name);
				$scope.generator.setCurrentSourcePath($scope.selectedSource);
				DymoTemplates.createAnnotatedBarAndBeatDymo($scope.generator, uris, $scope, $http);*/
				
				//DymoTemplates.createDeadheadDymo($scope.generator, $scope, $http);
				
				var parentUri = $scope.generator.addDymo();
				var childUri = $scope.generator.addDymo(parentUri);
				$scope.generator.setDymoFeature(childUri, ONSET_FEATURE, 2);
				
				//DymoTemplates.createGratefulDeadDymos($scope.generator, $scope, $http);
				//DymoTemplates.loadAndSaveMultipleDeadDymos($scope.generator, ['app/features/gd_test/Candyman/_studio/'], 0, $http);
				
				//DymoTemplates.createSebastianDymo3($scope.generator, $http);
			}
			
			$scope.loadDymo = function() {
				var dymoUri = 'features/gd_equal_similarity2/gd88-10-21.aud.ford-bryson.31108.sbeok.flacf.dymo.json';
				$scope.manager.loadDymoFromJson(dymoUri, function(loadedDymo) {
					$scope.generator.setDymo(loadedDymo);
					$scope.$apply();
					console.log("dymo loaded");
				}, function() {
					console.log("audio loaded");
				});
			}
			
			$scope.createAreasDemo = function(areas) {
				DymoTemplates.createAreasDemo($scope.generator, areas);
			}
			
			//TODO delegate to dymo-generator
			$scope.loadFeature = function() {
				$scope.generator.setCondensationMode($scope.selectedFeatureMode.name);
				$scope.generator.setCurrentSourcePath(inputDir+$scope.selectedFolder);
				new FeatureLoader($scope, $http).loadFeature(inputDir+$scope.selectedFolder+'/' + $scope.selectedFeature, $scope.labelCondition, $scope.generator, function() {
					
				});
			}
			
			$scope.save = function() {
				new DymoWriter($http).writeDymoToJson($scope.generator.dymo.toJsonHierarchy(), $scope.dymoPath);
			}
			
			$scope.play = function() {
				$scope.manager.startPlaying();
			}
			
			$scope.stop = function() {
				$scope.manager.stopPlaying();
			}
			
			$scope.dymoOnClick = function(dymo){
				if ($scope.selectedDymo != dymo) {
					$scope.selectedDymo = dymo;
					$scope.manager.startPlayingUri(CONTEXT_URI+dymo["@id"]);
				} else {
					$scope.selectedDymo = null;
					$scope.manager.stopPlayingUri(CONTEXT_URI+dymo["@id"]);
				}
				$scope.$apply();
			}
			
			$scope.updateGraph = function() {
				Benchmarker.startTask("graphsChanged")
				$scope.store.toJsonGraph(DYMO, $scope.selectedRelation.uri, function(graph) {
					$scope.currentGraph = graph;
					console.log($scope.currentGraph)
					setTimeout(function() {
						$scope.$apply();
						Benchmarker.print();
					}, 10);
				});
			}
			
			function onPlaybackChange(urisOfPlayingDymos) {
				$scope.urisOfPlayingDymos = urisOfPlayingDymos;
				setTimeout(function() {
					$scope.$apply();
				}, 10);
			}
			
			function adjustViewConfig(newFeature) {
				if ($scope.generator) {
					$scope.features = $scope.generator.getFeatures();
					if ($scope.features.length-2 == 1) {
						$scope.viewConfig.xAxis.param = newFeature;
					} else if ($scope.features.length-2 == 2) {
						$scope.viewConfig.yAxis.param = newFeature;
					} else if ($scope.features.length-2 == 3) {
						$scope.viewConfig.size.param = newFeature;
					} else if ($scope.features.length-2 == 4) {
						$scope.viewConfig.color.param = newFeature;
					}
				}
			}
			
			function postAudioFile(file, callback) {
				var request = new XMLHttpRequest();
				var formData = new FormData();
				formData.append('uploads[]', file, file.name);
				//console.log(formData)
				request.open('POST', 'postAudioFile', true);
				request.onload = function() {
					console.log(this.responseText);
					if (callback) {
						callback(this.responseText);
					}
				};
				request.error = function(e){
					console.log(e);
				};
				request.send(formData);
			}
			
		}]);

}());
