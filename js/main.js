/* Main JavaScript sheet, Ian Bachman-Sanders, March 2017*/

//make the whole script an anon function to avoid junk variables kicking around after
(function(){
//global variables (made local by anon function above)
var attrArray = ["AnimalAccident",	"Drought", "Earthquake", "Epidemic", "ExtremeTemperature", "Flood", "Impact", "InsectInfestation", "Landslide", "MassMovementDry", "Storm", "VolcanicActivity", "Wildfire"];
var expressed = attrArray[5]; //attribute expressed from array- can be changed!


window.onload = setMap();

//set up choropleth map
function setMap(){

	//SVG CANVAS
	//set dimensions based on client window size
	var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0) * 0.6 ;
	var h = w/2;

	//create svg container
	var map = d3.select("body") //select body of website
		.append("svg")//add svg canvas to the webpage
		.attr("width", w)//assign width
		.attr("height", h)//assign height
		.style("margin", function(d){ //keeping this in case I want to change margins
			var top = 0 * window.innerHeight;
			var side = 0 * window.innerWidth;
			var margins = top + " 0 0 " + side;
			return margins;
		})
		.attr("class", "map")
		;

	//create projection
	var projection = d3.geoMollweide() //TODO equal-area, but do you lose data?
		.translate([w/2,h/2]); //keep map centered in window

	//draw spatial data using path generator
	//create generator
	var path = d3.geoPath()
		.projection(projection) //use projection var as guide
		; //draw geometries with generator BELOW in callback

	//LOAD DATA
	//use d3's queue to asynchronically load mult sets of data
	d3.queue() //begin code block
		.defer(d3.csv, "data/WorldDisasters.csv") //load .csv data, equivalent to $.ajax(), or $.getJSON() in jQuery
		.defer(d3.json, "data/ne_50m_admin_0_countries.topojson") //load country topojson
		.await(callback) //when all data above has been loaded, execute callback
		; 

	function callback(error, WorldDisasters, WorldCountries){
		//translate WorldCountries from topoJSON to geoJSON using topojson.feature()
		var worldCountriesGeo = topojson.feature(WorldCountries, WorldCountries.objects.ne_50m_admin_0_countries).features; //param 1 is the object (loaded data), param 2 is the original file name holding dataset details

		//attach csv to geoJSON:
		CSVtoGeoJSON(WorldDisasters,worldCountriesGeo);

		//add graticules to map
		setGraticule(map,path);

		//create color scale for drawing countries
		var colorScale = makeColorScale(WorldDisasters);

		//add WorldCountries to map
		addCountries(map,worldCountriesGeo,path,colorScale);

		//add a chart to the page
		setChart(WorldDisasters, colorScale, h);

		//include a menu to select different disaster types
		selectMenu(WorldDisasters);

	};
};






function CSVtoGeoJSON(csv,geoJSON){
	//loop through CSV to assign attributes to build an array based on country name
	for (var i = 0; i < csv.length; i++) {
		var countryAttr = csv[i]; //store the object attributes for later
		var countryKey = countryAttr.name_long; //select the matching key (name) for that country
		for (var a = 0; a < geoJSON.length; a++) { //go through all the country geometries, searching fo r amatch to the key
			var countryGeoAttr = geoJSON[a].properties //I realize storing this in the code is worthwhile for editing later- can change the whole code chain
			var countryGeoKey = countryGeoAttr.name_long;
			if (countryKey == countryGeoKey) {
				//assign attributes if countries match
				attrArray.forEach(function(attr) { //for each attribute you want to compare...
					var csvAttr = countryAttr[attr]; //select the attribute val for this country from CSV
					countryGeoAttr[attr]= parseFloat(csvAttr); //apply the attr to the properties of the country geometry
				});
			};
		};
	};
};






function setGraticule(map,path) {
	//create a graticule generator
	var graticule = d3.geoGraticule()
		.step([15,15]); //graticule every x degrees lon,lat

	//draw graticule background
	var gratBack = map.append("path")
		.datum(graticule.outline()) //use the outline of the graticule paths as the data
		.attr("class","gratBack")
		.attr("d",path) //draw it!

	//draw the graticules
	var gratlines = map.selectAll(".gratlines") //iterate through gratlines
		.data(graticule.lines()) //creates dat for each lat lon line based on the generator
		.enter()
		.append("path")
		.attr("class","gratlines")
		.attr("d",path)
		;
};






function addCountries(map, geoJSON, path, colorScale) { 
	var countries = map.selectAll(".country") //iterate through all countries
		.data(geoJSON) //use world countires data
		.enter() //enter data into container
		.append("path") //add drawing element
		.attr("class", function(d){
			return "country " + d.properties.name_long; //apply class based on country name stored in topojson
		})
		.attr("d", path) //assign path generator 'path' to the <path> element's d (data)- not the same as worldCountriesGeo d (data)
		.style("fill", function(d) {
			return choropleth(d.properties, colorScale)
		})
		.on("mouseover", function(d){
			highlight(d.properties); //pass the country's properties object to the highlight or dehighlight functions, to be updated on mouseover
		})
		.on("mouseout", function(d){
			dehighlight(d.properties);
		})
		;

	var desc = countries.append("desc") //add an invisible element to store style information for dehighlight() function
		.text('{"stroke": "#444", "stroke-width": "1px"}')
		;
};






//create color scale
function makeColorScale(data) {
	var colorClasses = [ //orange color scheme- alarm/modern 
	"#feedde",
	"#fdbe85",
	"#fd8d3c",
	"#e6550d",
	"#a63603"
	];

	//create color scale generator
	var colorScale = d3.scaleThreshold()
		.range(colorClasses);

	//build a domain array for the attribute
	var domainArray = [];
	for (var i=0; i<data.length; i++) {
		var val = parseFloat(data[i][expressed]); //remember that 'expressed' is a global attribute!
		domainArray.push(val);
	};

	//cluster the data array using ckMeans clustering algorithm- creates natural breaks
	var clusters = ss.ckmeans(domainArray, 5); //accesses d3 simple-statistics, sets 5 clusters from the domain
	//reset domainArray as an array of the min of the 5 clusters you created to serve as breakpoints
	domainArray = clusters.map(function(d){
		return d3.min(d);
	});
	//remove first min value so that you have 4 breakpoints, 5 classes
	domainArray.shift();

	//assign the 4 breakpoints to the colorScale generator
	colorScale.domain(domainArray);

	return colorScale;
};






//help colorScale handle NULL values
function choropleth(props, colorScale) {
	//force into number
	var val = parseFloat(props[expressed]);
	//if value exists, assign color, otherwise, assign grey
	if (typeof val == "number" && !isNaN(val)) { //if type is  number and it isn't a non-number (isNaN tests this- is Not a Number? t/f)
		return colorScale(val);
	} else {
		return "#CCC"; //assigns grey
	};
};






//CHART- DATA VISUALIZATION
function setChart(csvData, colorScale, height) {
	//dimensions
	var chartW = window.innerWidth * 0.38, 
		chartH = height,
		leftPadding = chartW*0.1, //doing everything by ratio
		rightPadding = leftPadding/2,
		topPadding = chartH*0.1,
		bottomPadding = leftPadding,
		chartInnerW = chartW - leftPadding - rightPadding, //create inner chart to hold everything
		chartInnerH = chartH - topPadding - bottomPadding,
		translate = "translate(" + leftPadding + "," + topPadding + ")";

	//create a  new svg, add chart to it
	var chartContainer = d3.select("body")
		.append("svg")
		.attr("width", chartW)
		.attr("height", chartH)
		.attr("class", "chartContainer")
		.style("margin", function(d){ //keeping this in case I want to edit margins
			var top = 0 * window.innerHeight; //I like using proportions, so that things don't get awkward on really small/large screens
			var side = 0 * window.innerWidth;
			var margins = top + " " + side + " 0 0";
			return margins;
		})
		;

	//Build a chart area in the chartContainer
	var chartArea = chartContainer.append("rect")
		.attr("width", chartInnerW)
		.attr("height", chartInnerH)
		.attr("transform",translate)
		.attr("class","chartArea")

	//SCALES
	//create a scale to map out the country y placement based on population
	var yScale = d3.scaleLog() //create the scale generator (NOT object, it is a tool reliant upon input)
		//set scale range
		.range([chartInnerH,0]) 
		//use original w, h values
		.domain([1000, 1400000000]) //max from china
		; //input min and max (pulled from population values)

	//create x scale
	var xScale = d3.scaleLog() //scale generator
		.range([0,chartInnerW])
		.domain([250,102000]) //max is from Luxembourg
		;

	//SYMBOLS

	var circles = chartContainer.selectAll(".circle")
		.data(csvData)
		.enter()
		.append("circle")
		.sort(function(a,b) {
			return a[expressed]-b[expressed];
		})
		.attr("cx",function(d){
			var val = parseFloat(d.GDPperCapita.replace(',','')); //force GDP/capita into number
			if (typeof val == "number" && !isNaN(val)) {
				return xScale(val) + leftPadding;
			} else {
				return 0;
			};
		})
		.attr("cy",function(d){
			var val = parseFloat(d.Population);
			if (typeof val == "number" && !isNaN(val)) {
				return yScale(val) + topPadding;
			} else {
				return 0;
			};
		})
		.style("fill-opacity","0.8")
		.attr("class", function(d){
			return "circle "+d.name_long;
		})
		.attr("id",function(d){
			return d.name_long;
		})
		.on("mouseover", highlight) //call highlight funciton on mouseover (dehighlight below)
		.on("mouseout", dehighlight)
		;

	var desc = circles.append("desc") //store circles styling info invisibly for dehighlight() function
		.text('{"stroke": "#444", "stroke-width": "1px"}')
		;

	//AXES
	//create y-axis generator
	var yAxisG = d3.axisLeft(yScale)
		.scale(yScale)
		.ticks(10, ".0s")
		;

	//draw y-axis
	var yAxis = chartContainer.append("g")
		.attr("transform",translate) //move axis onto screen
		.attr("class","yAxis")
		.call(yAxisG) //same as yAxis(axis)
		;

	//draw y-axis title
	var yTitle = chartContainer.append("text")
		.attr("x",leftPadding+chartInnerW)
		.attr("y",chartInnerH+0.8*topPadding)
		.style("text-anchor","end")
		.text("GDP per Capita")
		.attr("class","yTitle")
		;

	//create x-axis generator
	var xAxisG = d3.axisBottom(xScale)
		.scale(xScale)
		.ticks(10, "$.0s")
		;

	//draw the x-axis
	var xAxis = chartContainer.append("g")
		.attr("transform","translate(" + leftPadding + "," + (chartInnerH + topPadding) + ")") //move axis onto screen
		.attr("class","xAxis")
		.call(xAxisG) //generate xAxis
		;

	//draw x-axis title
	var xTitle = chartContainer.append("text")
		.attr("transform","rotate(90 " + leftPadding*1.2 + " " + topPadding + ")")
		.attr("x",leftPadding*1.2)
		.attr("y",topPadding)
		.style("text-anchor","start")
		.text("Population")
		.attr("class","xTitle")
		;

	//Add title
	var title = chartContainer.append("text") //add a text element to the svg for a title
		.attr("text-anchor","middle") //anchor text to centerpoint
		.attr("x",chartW/2) //set text anchor location
		.attr("y",chartH*0.05)
		.attr("class","title") //provide a class, as always
		;

	//update circle styles
	updateCircles(circles,colorScale);

};






//create a menu to select disaster
function selectMenu(csvData) {
	//add the element
	var menu = d3.select("body")
		.append("select")
		//create an onChange listener, triggering the change attribute function!
		.on("change",function() {
			changeAttr(this.value, csvData)
		})
		.attr("class","menu")
		;

	//add first option
	var titleOption = menu.append("option")
		.attr("disabled","true")
		.text("Select Natural Disaster")
		.attr("class","titleOption")
		;

	//add attribute options
	var attrOptions = menu.selectAll("attrOptions")
		.data(attrArray)
		.enter()
		.append("option")
		.attr("value",function(d){return d;})
		.text(function(d){return d;})
		;
};






//ON USER SELECTION
function changeAttr(attribute,csvData) {
	//Change [expressed]
	expressed = attribute;
	//Recreate colorScale factoring in new [expressed]
	colorScale = makeColorScale(csvData);
	//Recolor countries
	var countries = d3.selectAll(".country") //simply restyle all elements with .countries class
		.transition() //include an animated transition between state changes, default settings
		.duration(1000)
		.style("fill",function(d){
			return choropleth(d.properties, colorScale)
		});
	//Update chart data
	var circles = d3.selectAll(".circle")
		//re sort
		.sort(function(a,b) {
			return a[expressed]-b[expressed];
		})
		.transition() //add animation
		.delay(function(d,i){
			return i * 15;
		})
		.duration(250)
		;
 
	//update circle styles
	updateCircles(circles,colorScale);
};






//reduce redundancies! Pack code into functions!
function updateCircles(circles,colorScale,title) {
	//resize
	circles.attr("r",function(d){
		var val = parseFloat(d[expressed]);
		if (typeof val == "number" && !isNaN(val)) {
			var area = val*100000000; //CHECK do we need a min size?
			return Math.sqrt(area/Math.PI); //derive circle size based on country population
		} else {
			return 0;
		};
	})
	//recolor
	.style("fill",function(d){
		return choropleth(d, colorScale);
	})
	;
	//update the title text
	var title = d3.selectAll(".title")
		.text([expressed]+" per Capita by Country")
};






//Dynamic highlighting
function highlight(country) {
	//change stroke
	var selected = d3.selectAll("."+country.name_long)
		.style("stroke","#444")
		.style("stroke-width","3")
		;
};






function dehighlight(country) {
	//select all countries
	var selected = d3.selectAll("."+country.name_long)
		.style("stroke",function() {
			return getStyle(this,"stroke"); //reference getStyle function below, which accesses <desc> element
		})
		.style("stroke-width",function(){
			return getStyle(this,"stroke-width");
		})
		;

	function getStyle(element,style) {
		var styleText = d3.select(element)
			.select("desc")
			.text()
			;

		var styleObject = JSON.parse(styleText); //change <desc> text into JSON object that responds to key:value queries

		return styleObject[style]; //return the value of the key provided, stroke or stroke-width
	};
};








})();//close anon wrapping function