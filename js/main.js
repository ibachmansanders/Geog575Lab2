/* Main JavaScript sheet, Ian Bachman-Sanders, March 2017*/
window.onload = setMap();

//set up chloropleth map
function setMap(){

	//SVG CANVAS
	//set dimensions
	var w = 960; //TODO make map full-screen?
	var h = 460;

	//create svg container
	var map = d3.select("body") //select body of website
		.append("svg")//add svg canvas to the webpage
		.attr("width", w)//assign width
		.attr("height", h)//assign height
		.attr("class", "map")
		;

	//create projection
	var projection = d3.geoMollweide() //TODO equal-area, but do you lose data?
		.translate([w/2,h/2]); //keep map centered in window

	//draw spatial data using path generator
	//create generator
	var path = d3.geoPath()
		.projection(projection) //use projection var as guide
		;

	//draw geometries with geneartor BELOW in callback

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

		//add graticules to map
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

		//add WorldCountries to map
		var countries = map.selectAll(".countries") //iterate through all countries
			.data(worldCountriesGeo) //use world countires data
			.enter() //enter data into container
			.append("path") //add drawing element
			.attr("class", function(d){
				return "countries " + d.properties.name_long; //apply class based on country name stored in topojson
			})
			.attr("d", path) //assign path generator 'path' to the <path> element's d (data)- not the same as worldCountriesGeo d (data)			;
			;


	};
};
