<template>
  <div>
    <div id="contenu" class="container">
      <b>Map of Users (2957 Users, 995 Institutes)</b>
      <br>
      <div class="bloc">
        <img
          src="http://twodoo.sedoo.fr:8480/eccad_extract_interface/images/legend_users.png"
          alt="image_rainbow"
          style="border: none"
        >

        <div id="infos" class="infos"> 
          Put your mouse on a
          <b>marker</b> to consult information about a registered institute.
          <br>To
          <b>zoom</b>, use the +/- on the left bar
          <b>or</b> double-click on the map
          <b>or</b>
          use the mouse's scroll wheel.
        </div>
        <button id="button" class="info-button">Informations</button>
      </div>
    </div>
    <div id="fullscreen" class="fullscreen">
      <div id="map" class="map"></div>

      <select id="layer-select" :onchange="displayMap()" v-model="value">
        <option disabled value>Please select a map</option>
        <option value="globalImagery">Global Imagery</option>
        <option value="naturalEarth">Natural Earth</option>
      </select>
      
      <select id="units" class="units">
        <option value="degrees">degrees</option>
        <option value="imperial">imperial inch</option>
        <option value="us">us inch</option>
        <option value="nautical">nautical mile</option>
        <option value="metric" selected>metric</option>
      </select>
      Laboratories
      <input type="checkbox" v-model="checked" v-on:change="displayMarks()">

      <div id="popup" class="ol-popup">
        <a href="#" id="popup-closer" class="ol-popup-closer"></a>
        <div id="popup-content"></div>
      </div>
    </div>
  </div>
</template>  

<script>

//import Highcharts from "ol/Highcharts.js";
//import highcharts from 'highcharts-release';
import Feature from "ol/Feature.js";
import Map from "ol/Map.js";
import Overlay from "ol/Overlay.js";
import View from "ol/View.js";
import { defaults as defaultControls, ScaleLine, FullScreen } from "ol/control.js";
import { toStringHDMS } from "ol/coordinate.js";
import GeoJSON from "ol/format/GeoJSON.js";
import Circle from "ol/geom/Circle.js";
/* import Style from "ol/style/Style";
import Stroke from "ol/style/Style.js"; */
import { Stroke, Style } from "ol/style.js";
import Text from "ol/style/Text";
import Fill from "ol/style/Fill";
import LayerGroup from "ol/layer/Group";
import { Tile as TileLayer } from "ol/layer.js";
import LineString from "ol/geom/LineString.js";
import Stamen from "ol/source/Stamen.js";
import VectorLayer from "ol/layer/Vector.js";

// carte
import TileWMS from "ol/source/TileWMS.js";
import SourceOSM from "ol/source/OSM.js";

import { fromLonLat, toLonLat } from "ol/proj.js";
import { OSM, Vector as VectorSource } from "ol/source.js";

// import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style.js';
import TileJSON from "ol/source/TileJSON.js";

//A ENLEVER QAND LE BACK END SERA FAIT
//import geojsonObject from "data.js";

export default {
  name: "aeris-map",

  props: {
    lang: {
      type: String,
      default: "en"
    },
    backendUrl: {
        type: String,
      default:  "http://localhost:8090",
    },
    /* geojsonObjectPop: {
      type: Array,
      default: []
    } */
    
  },

  data() {
    return {
      value: "",
      checked: true,
      OSMmap: {},
      globalImagery: {},
      naturalEarth: {},
      marksLayer: {},
      map: {},
      fondMap: null,
      geojsonObjectPop: []
    };
  },

  watch: {},
//----------------------------------------------------------------------
  methods: {

    recoveredData(){
    // base de l'objet geoJson sans les features
    this.geojsonObjectPop = {
      type: "FeatureCollection",
      crs: {
        type: "name",
        properties: {
          name: "EPSG:4326"
        }
      },
      features: []
    };
    
  // appel au back-end avec AXIOS  // a changer avec la bonne fin de l'url
 //-------------------------------------------------------------------------------
     this.$http.get(this.backendUrl + "/public/datasets/Organization").then(
      result => {
        //je crée un tableau vide qui contiendra les features
        var features = [];

        // pour chaque organization je crée une nlle feature
        result.data.forEach(organization => {
          var newFeature = {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [organization.longitude, organization.latitude]
            },
            properties: {
              FullName: organization.fullNameOrganization,
              ShortName: organization.shortNameOrganization,
              lat: "Lat : " + organization.latitude,
              lon: "Lon : " + organization.longitude,
              adress: organization.addressOrganization,
              Country: organization.country,
              url: organization.url,
              users: organization.numberOfPersons
            }
          };
          // je pousse la nlle feature dans le tableau de features
          features.push(newFeature);
        });

        // quand j'ai fini de crée toutes les features , je les mets dans le tableau vide.
        this.geojsonObjectPop.features = features;


        console.log(features[0].properties.FullName);
        //console.log(features[0].properties.ShortName);
        //console.log(features[0].properties.Country);

        //console.log(this.geojsonObjectPop);

        console.log(features);

        // mettre la fonction qui traite l'affichage ici
       this.display();


      },
      error => {
        console.error(error);
      }
    ); 
    },
   
//------------------------------------------------------------------------------------------------------------------------------------------------------
display(){

    /**
     * Elements that make up the popup.
     */
    var popupContainer = document.getElementById("popup");
    var popupContent = document.getElementById("popup-content");
    var popupCloser = document.getElementById("popup-closer");

 

    /* Add a click handler to hide the popup. 
@return {boolean} Don't follow the href. */

    popupCloser.onclick = function() {
      overlay.setPosition(undefined);
      popupCloser.blur();
      return false;
    };

     /**
     * Create an overlay to anchor the popup to the map.
     */
    var overlay = new Overlay({
      element: popupContainer,
      autoPan: true,
      autoPanAnimation: {
        duration: 250
      }
    });

    var scaleLineControl = new ScaleLine();

//--------------------------------------------------------------------------------------------------------------------------------------------------------------
// style des marqueurs 

    var styleFunction = function(feature) {
      //console.log(feature.getType());
      var props = feature.getProperties();
      var users = props.users;

      // if there are users, I convert the string into number
      if (users) {
        users = Number(users);
      }
       // recuperer le nombre de personnes dans une variable et appelé cette variable dans le fill
      var colorUser;

      if (users > 0 && users <= 1) {
        colorUser = "#000080";
      } else if (users > 1 && users <= 2) {
        colorUser = "#0000ff";
      } else if (users > 2 && users <= 3) {
        colorUser = "87ceeb";
      } else if (users > 3 && users <= 4) {
        colorUser = "#2e8b57";
      } else if (users > 4 && users <= 5) {
        colorUser = "#90ee90";
      } else if (users > 5 && users <= 6) {
        colorUser = "#ffff00";
      } else if (users > 6 && users <= 7) {
        colorUser = "#ffd700";
      } else if (users > 7 && users <= 8) {
        colorUser = "#ffa500";
      } else if (users > 8 && users <= 9) {
        colorUser = "#dc143c";
      } else if (users > 9 && users <= 10) {
        colorUser = "#8b0000";
      } else {
        colorUser = "#a9a9a9";
      }

      var styles = {
        Point: new Style({
          text: new Text({
            text: "\uf041", 
            font: "normal 20px FontAwesome",
            fill: new ol.style.Fill({
              color: colorUser
            })
          })
        })
      };
      return styles[feature.getGeometry().getType()];
    };

 var vectorSource = new VectorSource({
      features: new GeoJSON().readFeatures(this.geojsonObjectPop)
    });

    this.marksLayer = new VectorLayer({
      source: vectorSource,
      style: styleFunction,
    });

// FONDS DE CARTES
    (this.globalImagery = new TileLayer({
      title: "Global Imagery",
      source: new OSM({
        layer: "globalImagery"
      })
    })),

      (this.naturalEarth = new TileLayer({
        title: "Natural Earth",
        source: new TileWMS({
          url: "https://demo.boundlessgeo.com/geoserver/ows?",
          params: {
            LAYERS: "ne:NE1_HR_LC_SR_W_DR",
            TILED: true
          }
        })
      })),

//------------------------------------------------------------------
// création de la carte

      this.map = new Map({
        controls: defaultControls().extend([
          // scale line
          scaleLineControl, // toogle full-screen
          new FullScreen({
            source: "fullscreen"
          })
        ]),
        overlays: [overlay],
        renderer: "canvas",
        target: "map",
        layers: [this.globalImagery, this.naturalEarth, this.marksLayer],

        view: new View({
          projection: "EPSG:4326",
          center: [0, 0],
          zoom: 2
        }),
        
      });
//----------------------------------------------------------------------
    var unitsSelect = document.getElementById("units");

    function onChange() {
      scaleLineControl.setUnits(unitsSelect.value);
    }
   unitsSelect.addEventListener("change", onChange);
    
//----------------------------------------------------------------------------------------------------------------------
// onclick event  
     this.map.on("click", event => {
      var coordinate = event.coordinate;
      var featureObj;

      var featureAtPixel = this.map.forEachFeatureAtPixel(event.pixel, function(feature) {
   
        featureObj = feature;

        return feature;
      });
        if(featureObj) {
          var props = featureObj.getProperties();

          //var hdms = toStringHDMS(toLonLat(coordinate));

Object.keys(props).forEach(function(key){
  //console.log(key,props[key]);
  popupContent.innerHTML += props[key] + "<br>";
});

// comment parcourir les clés du tableau (objet JSON)?
           for (var key in props[key]) {

             //if (props[key] instanceof String) {
              popupContent.innerHTML += props[key] + "<br>";
            } 
          overlay.setPosition(coordinate); 
        } else {
         // popupContent.innerHTML = 'NE MARCHE PAS !!!';
        }
      });
//---------------------------------------------------------------------------------------------------------------------------
// bouton informations

    document.querySelector("#button").onclick = function() {
      if (window.getComputedStyle(document.querySelector("#infos")).display == "none") {
        document.querySelector("#infos").style.display = "block";
      } else {
        document.querySelector("#infos").style.display = "none";
      }
    };
  },
//--------------------------------------------------------------------------------------------------------------------------------
    displayMap() {
      if (this.value == "globalImagery") {
        this.globalImagery.setVisible(true);
        this.naturalEarth.setVisible(false);
      } else if (this.value == "naturalEarth") {
        this.globalImagery.setVisible(false);
        this.naturalEarth.setVisible(true);
      }
    },

     displayMarks() {
      this.marksLayer.setVisible(this.checked);
    },
  },
//-------------------------------------------------------------------------------------------------------------------------------------
  mounted() {
    this.recoveredData();
  }
//---------------------------------------------------------------------------------------------------------------------------------------------
};

</script>

<style>
/*  #container {
  min-width: 110px;
  height: 400px;
  /* margin: 0 auto; 
}  
*/

.info-button {
  background-color: #000099;
  color: white;
}

.infos {
  display: none;
  font-size: 0.9em;
}

 .fullscreen:-moz-full-screen {
  height: 100%; 
  min-width: 210px;
  max-width: 1400px;
   
}
.fullscreen:-webkit-full-screen {
  height: 100%;
  min-width: 210px;
  max-width: 1400px;
}
.fullscreen:-ms-fullscreen {
  height: 100%;
  min-width: 210px;
  max-width: 1400px;
}

.fullscreen:fullscreen {
  height: 100%;
  min-width: 210px;
  max-width: 1400px;
}

.fullscreen {
  margin-bottom: 10px;
  width: 100%;
  height: 100%;
  min-width: 210px;
  max-width: 1400px;
} 

.ol-scale-line {
  background: rgb(0, 60, 136, 0.5);
  padding: 5px;
}

.units {
  margin: 0px;
}

.map {
  width: 100%;
  height: 100%;
  margin: auto;
  padding: auto;
}

.ol-popup {
  position: absolute;
  background-color: white;
  -webkit-filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.2));
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.247));
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #cccccc;
  bottom: 15px;
  left: -50px;
  min-width: 300px;
  height: 200px;
  color: rgb(73, 73, 77);
  overflow-y: scroll;
  font-size: 0.9em;
  text-align: left;
  font-family: Helvetica, Arial, sans-serif;
}
.ol-popup:after,
.ol-popup:before {
  top: 100%;
  border: solid transparent;
  content: " ";
  height: 0;
  width: 0;
  position: absolute;
  pointer-events: none;
}
.ol-popup:after {
  border-top-color: white;
  border-width: 10px;
  left: 48px;
  margin-left: -10px;
}
.ol-popup:before {
  border-top-color: #cccccc;
  border-width: 11px;
  left: 48px;
  margin-left: -11px;
}
.ol-popup-closer {
  text-decoration: none;
  position: absolute;
  top: 2px;
  right: 8px;
}
.ol-popup-closer:after {
  content: "✖";
}

.container {
  padding: 5px;
  color: #000099;
  width: 100%;
  /* background: #cdd6f0; */
  vertical-align: top;
  background-color: #e3f1ff;
  text-align: center;
}

img {
  display: inline;
}
</style> 



