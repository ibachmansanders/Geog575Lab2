/* Main JavaScript sheet, Ian Bachman-Sanders, March 2017*/

//make the whole script an anon function to avoid junk variables kicking around after
(function(){
//global variables (made local by anon function above)
var attrArray = ["AnimalAccident",	"Drought", "Earthquake", "Epidemic", "ExtremeTemperature", "Flood", "Impact", "InsectInfestation", "Landslide", "MassMovementDry", "Storm", "VolcanicActivity", "Wildfire"];
var attrArrayTitles = [{"AnimalAccident":"Animal Accident"},	{"Drought":"Drought"}, {"Earthquake":"Earthquake"}, {"Epidemic":"Epidemic"}, {"ExtremeTemperature":"Extreme Temperature"}, {"Flood":"Flood"}, {"Impact":"Impact"}, {"InsectInfestation":"Insect Infestation"}, {"Landslide":"Landslide"}, {"MassMovementDry":"Mass Movement Dry"}, {"Storm":"Storm"}, {"VolcanicActivity":"Volcanic Activity"}, {"Wildfire":"Wildfire"}];
var expressed = attrArray[10]; //attribute expressed from array- can be changed!
var eIndex = attrArray.indexOf(expressed); //isolate the index of the current expressed array item for lookup in the attrAarrayTitles hashtable

//set dimensions based on client window size
var w = $("#container").width() * 0.6 ;
var h = window.innerHeight;

//dimension global variables
var chartW = $("#container").width() * 0.37, 
	chartH = h,
	leftPadding = chartW*0.1, //doing everything by ratio
	rightPadding = leftPadding/2,
	topPadding = chartH*0.1,
	bottomPadding = leftPadding,
	chartInnerW = chartW - leftPadding - rightPadding, //create inner chart to hold everything
	chartInnerH = chartH - topPadding - bottomPadding,
	translate = "translate(" + leftPadding + "," + topPadding + ")";


//window.onload = setMap();
window.onresize =setMap();

//set up choropleth map
function setMap(){

	//resize map and chart svg
	//d3.select(window)
		//.on("resize",sizeChange)
		//;

	//SVG CANVAS

	//create svg container
	var map = d3.select("#container") //select body of website
		.append("div")
		.classed("svg-container",true)
		.attr("id","#mapDiv")
		.append("svg")//add svg canvas to the webpage
		.attr("preserveAspectRatio", "xMinYMin meet")//force svg to keep its shape
		.attr("viewBox","0 0 "+ w + " " + h )//assign viewbox dimensions
		.classed("svg-content-responsive",true)
		.style("margin", function(d){ //keeping this in case I want to change margins
			var top = 0 * window.innerHeight;
			var side = 0 * window.innerWidth;
			var margins = top + " 0 0 " + side;
			return margins;
		})
		.attr("class", "map")
		;

	var scale = 140/1400; //I computed that 140 was a good scale @ ~ 1400px, so I created a coefficient to read screan sizes.
	var scaleF = window.innerWidth*scale;
	//create projection
	var projection = d3.geoMollweide() //TODO equal-area, but do you lose data?
		.translate([w/2,h/2])
		.scale(scaleF)
		; //keep map centered in window

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
		setChart(WorldDisasters, colorScale, map);

		//include a menu to select different disaster types
		selectMenu(WorldDisasters,map);

	};
};






function CSVtoGeoJSON(csv,geoJSON){
	//loop through CSV to assign attributes to build an array based on country name
	for (var i = 0; i < csv.length; i++) {
		var countryAttr = csv[i]; //store the object attributes for later
		var countryKey = countryAttr.brk_a3; //select the matching key (name) for that country
		for (var a = 0; a < geoJSON.length; a++) { //go through all the country geometries, searching fo r amatch to the key
			var countryGeoAttr = geoJSON[a].properties //I realize storing this in the code is worthwhile for editing later- can change the whole code chain
			var countryGeoKey = countryGeoAttr.brk_a3;
			if (countryKey == countryGeoKey) {
				//assign attributes if countries match
				attrArray.forEach(function(attr) { //for each attribute you want to compare...
					var csvAttr = countryAttr[attr]; //select the attribute val for this country from CSV
					countryGeoAttr[attr]= parseFloat(csvAttr); //apply the attr to the properties of the country geometry
					countryGeoAttr["Population"]= parseFloat(countryAttr["Population"]); //include population for later calculations
					countryGeoAttr["GDPperCapita"]= parseFloat(countryAttr["GDPperCapita"]);
				});
			};
		};
	};
};







//create a domain array for use throughout the map
function makeDomainArray(csvData){
	//build a domain array for the attribute
	var domainArray = [];
	for (var i=0; i<csvData.length; i++) {
		var val = parseFloat(csvData[i][expressed]); //remember that 'expressed' is a global attribute!
		domainArray.push(val);
	};
	return domainArray;
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
			return "country " + d.properties.brk_a3; //apply class based on country name stored in topojson
		})
		.attr("id",function(d){
			return "country"+d.properties.brk_a3;
		})
		.attr("d", path) //assign path generator 'path' to the <path> element's d (data)- not the same as worldCountriesGeo d (data)
		.style("fill", function(d) {
			if (parseFloat(d.properties[expressed])>0) {
				return choropleth(d.properties, colorScale);
			} else {
				return  "#CCC";
			};
		})
		.on("mouseover", function(d){
			highlight(d.properties); //pass the country's properties object to the highlight or dehighlight functions, to be updated on mouseover
		})
		.on("mouseout", function(d){
			dehighlight(d.properties);
		})
		.on("mousemove",moveLabel)
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

	var domainArray = makeDomainArray(data);

	//cluster the data array using ckMeans clustering algorithm- creates natural breaks
	var clusters = ss.ckmeans(domainArray, 5); //accesses d3 simple-statistics, sets 5 clusters from the domain
	//resevar domainArray = domainArray(data);t domainArray as an array of the min of the 5 clusters you created to serve as breakpoints
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
function setChart(csvData, colorScale, map) {

	//create a  new svg, add chart to it
	var chartContainer = d3.select("#container")
		.append("div") //add a div within our container
		.classed("svg-container2",true) //sets this as a specific type of container, allowing me to manipulate width, aspect ratio in css
		.attr("id","#chartDiv") // just to have it for sizing later
		.append("svg")
		.attr("preserveAspectRatio", "xMinYMin meet")//force svg to keep its shape
		.attr("viewBox","0 0 "+ chartW + " " + chartH )//assign viewbox dimensions
		.classed("svg-content-responsive2",true)
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
	//Y is in updateCircles, as it is dynamic

	//create x scale
	var xScale = d3.scaleLog() //scale generator
		.range([0,chartInnerW])
		.domain([10000000,18100000000000]) //max is from US
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
			var pop = parseFloat(d.Population);
			if (typeof val == "number" && !isNaN(val)) {
				return xScale(val*pop) + leftPadding; //to calculate total GDP for country
			} else {
				return 0;
			};
		})
		.attr("class", function(d){
			return "circle "+d.brk_a3;
		})
		.attr("id",function(d){
			return "circle"+d.brk_a3;
		})
		.on("mouseover", highlight) //call highlight funciton on mouseover (dehighlight below)
		.on("mouseout", dehighlight)
		.on("mousemove", moveLabel)
		;

	var desc = circles.append("desc") //store circles styling info invisibly for dehighlight() function
		.text('{"stroke": "#444", "stroke-width": "1px"}')
		;

	//AXES
	//draw y-axis (scale etc. added in updateCircles)
	var yAxis = chartContainer.append("g")
		.attr("transform",translate) //move axis onto screen
		.attr("class","yAxis")
		;

	//include y-axis title (text added in updateCircles)
	var yTitle = chartContainer.append("text")
		.attr("transform","rotate(90 " + leftPadding*1.2 + " " + topPadding + ")")
		.attr("x",leftPadding*1.2)
		.attr("y",topPadding)
		.style("text-anchor","start")
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

	//include x-axis title
	var xTitle = chartContainer.append("text")
		.attr("x",leftPadding+chartInnerW)
		.attr("y",chartInnerH+0.8*topPadding)
		.style("text-anchor","end")
		.text("GDP")
		.attr("class","xTitle")
		;

	//Add title
	var title = chartContainer.append("text") //add a text element to the svg for a title
		.attr("text-anchor","middle") //anchor text to centerpoint
		.attr("x",chartW/2) //set text anchor location
		.attr("y",chartH*0.05)
		.attr("class","title") //provide a class, as always
		;

	//ADD LEGEND
	//create legend data for population circles based on the range of population from smallest to largest
	var legendDataCircles = [
		1000,
		350000750,
		700000500,
		1050000250,
		1400000000
	];


	//get the domain array to use for the legend
	var domainArray = makeDomainArray(csvData);

	//cluster the data array using ckMeans clustering algorithm- creates natural breaks
	var clusters = ss.ckmeans(domainArray, 5); //accesses d3 simple-statistics, sets 5 clusters from the domain
	//resevar domainArray = domainArray(data);t domainArray as an array of the min of the 5 clusters you created to serve as breakpoints
	var legendColors = clusters.map(function(d){
		return d3.median(d);
	});

	//Add Legend
	var legendCircles = map.selectAll(".legendCircles")
		.data(legendDataCircles)
		.enter()
		.append("circle")
		.sort(function(a,b) {
			return b-a;
		})
		.attr("r",function(d){
			var val = parseFloat(d);
			if (typeof val == "number" && !isNaN(val)) {
				var area = val/100000; //CHECK do we need a min size?
				return Math.sqrt(area/Math.PI); //derive circle size based on country population
			} else {
				return 0;
			};
		})
		.attr("cy",function (){
			var y = 0.95*h-this.getAttribute("r");
			return y;
		})
		.attr("cx",w*0.9)
		.style("fill-opacity",0.8)
		.style("fill","none")
		.style("stroke","#444")
		.style("stroke-width","1px")
		.attr("class","legendCirlces")
		;

	//update circle styles
	updateCircles(circles,colorScale,csvData);

	//create legendRects
	createLegendRects(map,colorScale,legendColors);

};






function createLegendRects(map,colorScale,legendColors){
	var legendRects = map.selectAll(".legendRects")
		.data(legendColors)
		.enter()
		.append("rect")
		.sort(function(a,b){
			return a-b;
		})
		.attr("width",w/9)
		.attr("height",h/20)
		.attr("x", function(d,i) {
			return w/9*(i+2)
		})
		.attr("y",function(d){
			return h*0.95-(this.getAttribute("height"));
		})
		.transition() //include an animated transition between state changes, default settings
		.duration(1000)
		.style("stroke","#444")
		.style("fill-opacity",0.8)
		.style("fill",function(d){
			if (parseFloat(d)>0) {
				return colorScale(d);
			} else {
				return  "#CCC";
			};
		})
		.attr("class","legendRects")
		;

	//add legend numbers
	var legendNums = map.selectAll(".legendNums")
		.data(legendColors)
		.enter()
		.append("text")//add a text element
		.sort(function(a,b){
			return a-b;
		})
		.attr("text-anchor","middle")
		.attr("width",w/9)
		.attr("height",h/20)
		.attr("x", function(d,i) {
			return w/9*(i+2) + (this.getAttribute("width")/2);
		})
		.attr("y",function(d){
			return h*0.95-(this.getAttribute("height")/2);
		})
		.text(function(d){return d;})
		.attr("class","legendNums")
		;

}





//create a menu to select disaster
function selectMenu(csvData,map) {
	//add the element
	var menu = d3.select("body")
		.append("select")
		//create an onChange listener, triggering the change attribute function!
		.on("change",function() {
			changeAttr(this.value, csvData,map)
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
function changeAttr(attribute,csvData,map) {
	//Change [expressed]
	expressed = attribute;
	eIndex = attrArray.indexOf(expressed);
	//Recreate colorScale factoring in new [expressed]
	colorScale = makeColorScale(csvData);
	//Recolor countries
	var countries = d3.selectAll(".country") //simply restyle all elements with .countries class
		.transition() //include an animated transition between state changes, default settings
		.duration(1000)
		.style("fill",function(d){
			if (parseFloat(d.properties[expressed])>0) {
				return choropleth(d.properties, colorScale);
			} else {
				return  "#CCC";
			};
		});
	//Update chart data
	var circles = d3.selectAll(".circle")
		//re sort
		.sort(function(a,b) {
			return a[expressed]-b[expressed];
		})
		.transition() //add animation
		.delay(function(d,i){
			return i * 5;
		})
		.duration(250)
		;
 
	//update circle styles
	updateCircles(circles,colorScale,csvData);

	//update rectLegend
	d3.selectAll(".legendRects")
		.remove()
		;

	//create new color array for legendrects
	var domainArray = makeDomainArray(csvData);

	//cluster the data array using ckMeans clustering algorithm- creates natural breaks
	var clusters = ss.ckmeans(domainArray, 5); //accesses d3 simple-statistics, sets 5 clusters from the domain
	//resevar domainArray = domainArray(data);t domainArray as an array of the min of the 5 clusters you created to serve as breakpoints
	var legendColors = clusters.map(function(d){
		return d3.median(d);
	});
	createLegendRects(map,colorScale,legendColors);
};






//reduce redundancies! Pack code into functions!
function updateCircles(circles,colorScale,csvData) {
	//set y-Scale
	//create a chartContainer object for manipulation
	var chartContainer = d3.select(".chartContainer");
	//get the domain array to use for the y-axis
	var yDomainArray = [];
	for (var i=0; i<csvData.length; i++) {
		var val = Math.round(csvData[i][expressed]*csvData[i].GDPperCapita); //remember that 'expressed' is a global attribute!
		yDomainArray.push(val);
	};

	//isolate minmax
	var arrayMin = d3.min(yDomainArray);
	var arrayMax = d3.max(yDomainArray);

	//create a scale to map out the country y placement based on population
	var yScale = d3.scaleLinear() //create the scale generator (NOT object, it is a tool reliant upon input)
		//set scale range
		.range([chartInnerH*0.97,0]) 
		//use original w, h values
		.domain([arrayMin, arrayMax]) //max is max # of events
		; //input min and max (pulled from population values)

	//create y-axis generator
	var yAxisG = d3.axisLeft(yScale)
		.scale(yScale)
		.ticks(10, ".0s")
		;

	//draw y-axis
	var yAxis = d3.select(".yAxis")
		.transition()
		.duration(1000)
		.call(yAxisG) //same as yAxis(axis)
		;

	//include y-axis title
	var yTitle = d3.select(".yTitle")
		.transition()
		.duration(1000)
		.text(attrArrayTitles[eIndex][expressed]+" Events")
		;


	//resize and place circles
	circles.attr("r",function(d){
		var val = parseFloat(d.Population);
			if (typeof val == "number" && !isNaN(val)) {
				var area = val/300000; //CHECK do we need a min size?
				return Math.sqrt(area/Math.PI); //derive circle size based on country population
			} else {
				return 0;
			};
		})
		//recolor
		.style("fill",function(d){
			if (parseFloat(d[expressed])>0) {
				return choropleth(d, colorScale);
			} else {
				return  "#CCC";
			};
		})
		//set y value
		.attr("cy",function(d){
			var val = parseFloat(d[expressed])*parseFloat(d.GDPperCapita);
			if (typeof val == "number" && !isNaN(val)) {
				return yScale(val) + topPadding;
			} else {
				return 0;
				console.log(d.name_long);
			};
		})
		;

	//set the title text
	var title = d3.selectAll(".title")
		.text(attrArrayTitles[eIndex][expressed]+" Wealth Index by Country")
		;
};






//Dynamic highlighting for countries
function highlight(country) {
	//change stroke
	var selected = d3.selectAll("#country"+country.brk_a3)
		.style("stroke","rgba(217,72,1,0.5)")
		.style("stroke-width","10")
		;
	//change stroke
	var selected = d3.selectAll("#circle"+country.brk_a3)
		.style("stroke","#444")
		.style("stroke-width","4")
		;
	setLabel(country); //call popup label
};







function dehighlight(country) {
	//select all countries
	var selected = d3.selectAll("."+country.brk_a3)
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

	//remove info label
	d3.select(".label")
		.remove()
		;
};



//noData(Math.round(country[expressed]*country.GDPperCapita))


//create dynamic labels
function setLabel(country){
	//label content
	var numEvents = Math.round(parseFloat(country[expressed])*parseFloat(country.GDPperCapita))
	var header = "<h1>" + numEvents + "</h1>"+
		attrArrayTitles[eIndex][expressed]+" Events";

	//create info label div
	var label = d3.select("body")
		.append("div")
		.attr("id",country.brk_a3+"_label") //unique identifier
		.html(header) //insert the above html into the label
		.attr("class","label")
		;

	var content = label.append("div")
		.html("<b>"+country.name_long+"</b><br>"+
			"Population: " + noData(abbreviateNumber(parseFloat(country.Population)))+"<br>"+
			"GDP per Capita USD: " + noData(abbreviateNumber(parseFloat(country.GDPperCapita))))
		.attr("class","content")
		;
	//function for formatting numbers, provided by: http://stackoverflow.com/questions/10599933/convert-long-number-into-abbreviated-string-in-javascript-with-a-special-shortn
	function abbreviateNumber(value) {
    var newValue = Math.round(value);
	    if (value >= 1000) {
	        var suffixes = ["", "k", "m", "b","t"];
	        var suffixNum = Math.floor( (""+newValue).length/3.0001 ); //identifies place (thousands, millions, etc.)
	        var shortValue = '';
	        for (var precision = 3; precision >= 1; precision--) {
	            shortValue = parseFloat( (suffixNum != 0 ? (value / Math.pow(1000,suffixNum) ) : value).toPrecision(precision)); //reduce number to it's factor (10000 > 10, 550000000 > 550)
	            var dotLessShortValue = (shortValue + '').replace(/[^a-zA-Z 0-9]+/g,'');
	            if (dotLessShortValue.length <= 2) { break; }
	        }
	        if (shortValue % 1 != 0)  shortNum = shortValue.toFixed(1); //provides one decimal if it doesn't divide evenly
	        newValue = shortValue+suffixes[suffixNum]; //add suffix
	    }
	    return newValue;
	};
	//catch and replace NaN responses
	function noData(value){
		if(String(value) == "NaN"){
			return "No data";
		} else {
			return value
		};
	};
};






//set label position by mouse
function moveLabel(){
	//caputre label width
	var labelWidth = d3.select(".label")
	.node() //isolate label node in DOM (so cool...)
	.getBoundingClientRect() //get outline
	.width
	;

	//use mouse coordinates to set label coordinates
	var x1 = d3.event.clientX + 10,
		y1 = d3.event.clientY - 75; //closer to top of page than actual country
		x2 = d3.event.clientX - labelWidth-10; //too close to right? Flip label to left
		y2 = d3.event.clientY + 25; //...and up a bit

	//assign coordinates of label based on client mouse location
	var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; //conditional if mouse is within labelWidth +20 px
	var y = d3.event.clientY < 75 + 20 ? y2 : y1; //conditional if mouse is within your adjusted y value above (label goes DOWN from mouse point)

	d3.select(".label")
		.style("left", x + "px") //label position is absolute, so margin wouldn't work- left and top refer to view window
		.style("top", y + "px")
		;
};






//resize map or chart
function sizeChange(){

	var oldWidth = $(".map").width();

	//change svg sizes based on window size
	$(".map").width($("#container").width()*0.6); //grab div, calc map width to div
	$(".map").height(window.innerHeight); //100% height
	$(".chartContainer").width($("#container").width()*0.37); //ditto for chart
	$(".chartContainer").height($(window).height());
};





})();//close anon wrapping function