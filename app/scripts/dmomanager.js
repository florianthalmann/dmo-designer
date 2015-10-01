function DmoManager(scheduler, $scope) {
	
	var self = this;
	
	this.graph = {nodes:[], links:[]};
	this.playingDmos = [];
	toRealDmo = {}; //saves all real dmos for now
	
	this.features = [createFeature("time"), createFeature("duration"), createFeature("random", 0, 1)];
	
	var maxDepth = 0;
	
	this.getRealTopDmo = function() {
		return toRealDmo[this.graph.nodes[0]["@id"]];
	}
	
	this.getRealDmo = function(dmo) {
		return toRealDmo[dmo["@id"]];
	}
	
	this.addDmo = function() {
		//set as top-level dmo if none exists
		if (this.graph.nodes.length <= 0) {
			addTopDmo();
		//add as part if one exists
		} else {
			addPartDmo(this.graph.nodes[0], createNewDmo());
		}
		//createPitchHelixDmo();
	}
	
	function createPitchHelixDmo() {
		getFeature("chroma");
		getFeature("height");
		var previousDmo = null;
		for (var i = 0; i < 48; i++) {
			var currentDmo = createNewDmo(1,1);
			var cos = Math.cos((i % 12) / 6 * Math.PI);
			var sin = Math.sin((i % 12) / 6 * Math.PI);
			currentDmo.chroma = cos+1;
			currentDmo.height = sin+1+(i/4.5);
			if (previousDmo) {
				addPartDmo(previousDmo, currentDmo);
			} else {
				setTopLevelDmo(currentDmo);
			}
			previousDmo = currentDmo;
		}
	}
	
	function addTopDmo() {
		registerDmo(createNewDmo());
		self.getRealTopDmo().setSourcePath($scope.sourceFile);
	}
	
	function addPartDmo(parent, part) {
		registerDmo(part);
		parent["hasPart"].push(part);
		var link = {"source":parent, "target":part, "value":1};
		self.graph.links.push(link);
		toRealDmo[parent["@id"]].addPart(toRealDmo[part["@id"]]);
	}
	
	function registerDmo(dmo) {
		self.graph.nodes.push(dmo);
		toRealDmo[dmo["@id"]] = new DynamicMusicObject(dmo["@id"], scheduler, undefined, self);
		toRealDmo[dmo["@id"]].setSegment(dmo["time"].value, dmo["duration"].value);
		updateMinMaxes(dmo);
	}
	
	function updateMinMaxes(dmo) {
		for (var i = 0; i < self.features.length; i++) {
			updateMinMax(dmo, self.features[i]);
		}
	}
	
	function updateMinMax(dmo, feature) {
		if (dmo[feature.name]) {
			if (feature.max == undefined) {
				feature.min = dmo[feature.name].value;
				feature.max = dmo[feature.name].value;
			} else {
				feature.min = Math.min(dmo[feature.name].value, feature.min);
				feature.max = Math.max(dmo[feature.name].value, feature.max);
			}
		}
	}
	
	this.addFeature = function(name, data) {
		//iterate through all levels and add averages
		var feature = getFeature(name);
		for (var i = 0; i < this.graph.nodes.length; i++) {
			var currentTime = this.graph.nodes[i]["time"].value;
			var currentDuration = this.graph.nodes[i]["duration"].value;
			var currentValues = data.filter(
				function(x){return currentTime <= x.time.value && x.time.value < currentTime+currentDuration}
			);
			var value = 0;
			if ($scope.selectedFeatureMode.name == "first") {
				value = currentValues[0].value[0];
			} else if ($scope.selectedFeatureMode.name == "average") {
				value = currentValues.reduce(function(sum, i) { return sum + i.value[0]; }, 0) / currentValues.length;
			} else if ($scope.selectedFeatureMode.name == "median") {
				currentValues.sort(function(a, b) { return a.value[0] - b.value[0]; });
				var middleIndex = Math.floor(currentValues.length/2);
				value = currentValues[middleIndex].value[0];
				if (currentValues.length % 2 == 0) {
					value += currentValues[middleIndex-1].value[0];
				}
			}
			setDmoFeature(this.graph.nodes[i], feature, value);
		}
	}
	
	function getFeature(name) {
		//if already exists return that
		for (var i = 0; i < self.features.length; i++) {
			if (self.features[i].name == name) {
				return self.features[i];
			}
		}
		//if doesn't exist make a new one
		var newFeature = createFeature(name);
		self.features.splice(self.features.length-1, 0, newFeature);
		return newFeature;
	}
	
	function createFeature(name, min, max) {
		if (min != undefined && max != undefined) {
			return {name:name, min:min, max:max};
		}
		return {name:name, min:1, max:0};
	}
	
	function setDmoFeature(dmo, feature, value) {
		if (dmo[feature.name]) {
			dmo[feature.name].value = value;
		} else {
			addFeatureToDmo(dmo, feature.name, value);
		}
		updateMinMax(dmo, feature);
	}
	
	this.addSegmentation = function(segments) {
		if (self.graph.nodes.length <= 0) {
			addTopDmo();
		}
		for (var i = 0; i < segments.length-1; i++) {
			var newDmo = createNewDmo();
			newDmo["time"].value = segments[i].time.value;
			newDmo["duration"].value = segments[i+1].time.value - newDmo["time"].value;
			if (segments[i].label) {
				newDmo.segmentLabel = segments[i].label.value;
			}
			parent = getSuitableParent(newDmo);
			updateParentDuration(parent, newDmo);
			addPartDmo(parent, newDmo);
		}
		maxDepth++;
	}
	
	function getSuitableParent(dmo) {
		var nextCandidate = self.graph.nodes[0];
		var depth = 0;
		while (depth < maxDepth) {
			var parts = nextCandidate.hasPart;
			if (parts.length > 0) {
				for (var i = 0; i < parts.length; i++) {
					if (parts[i]["time"].value <= dmo["time"].value) {
						nextCandidate = parts[i];
						depth++;
					} else {
						break;
					}
				}
			} else {
				return nextCandidate;
			}
		}
		return nextCandidate;
	}
	
	function updateParentDuration(parent, newDmo) {
		if (!("time" in parent) || newDmo["time"].value < parent["time"].value) {
			parent["time"].value = newDmo["time"].value;
		}
		if (!("duration" in parent) || parent["time"].value+parent["duration"].value < newDmo["time"].value+newDmo["duration"].value) {
			parent["duration"].value = (newDmo["time"].value+newDmo["duration"].value) - parent["time"].value;
		}
		updateMinMaxes(parent);
	}
	
	var createNewDmo = function(time, duration) {
		if (!time) {
			time = Math.random();
		}
		if (!duration) {
			duration = Math.random();
		}
		var newDmo = {
			"@id": "dmo" + (self.graph.nodes.length+1),
			"@type": "DMO",
			"hasPart": []
		}
		addFeatureToDmo(newDmo, "time", time);
		addFeatureToDmo(newDmo, "duration", duration);
		return newDmo;
	}
	
	var addFeatureToDmo = function(dmo, name, value) {
		dmo[name] = {
			"value" : value,
			"adt" : name.charAt(0).toUpperCase() + name.slice(1),
		};
	}
	
	this.updatePlayingDmos = function(dmo) {
		var newDmos = [];
		var currentDmo = dmo;
		while (currentDmo != null) {
			newDmos.push(currentDmo.getUri());
			currentDmo = currentDmo.getParent();
		}
		this.playingDmos = newDmos;
		setTimeout(function() {
			$scope.$apply();
		}, 10);
	}

}
