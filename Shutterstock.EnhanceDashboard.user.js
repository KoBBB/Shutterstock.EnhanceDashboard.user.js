// ==UserScript==
// @name         Shutterstock.EnhanceDashboard
// @namespace    
// @version      1.0.5
// @updateURL    https://gist.github.com/deymosD/ff4b0effbffefd76f58300b01e45afd4/raw/49c4aceb549ede740ff1ec6409254c46da5ba207/Shutterstock.EnhanceDashboard.user.js
// @description  Show detailed localization to Shutterstock Latest Downloads map, based on Satinka's https://gist.github.com/satinka/5479a93d389a07d41246
// @author       Satinka, GG update
// @match        https://submit.shutterstock.com/dashboard*
// @copyright    2016, Satinka
// @require      http://code.jquery.com/jquery-latest.min.js
// @require      https://code.jquery.com/ui/1.11.4/jquery-ui.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.2/rollups/md5.js 
// @grant        none

// ==/UserScript==
/* jshint -W097 */

// NEWS
// v1.6: hashes SS response for location and image earnings
//       enables dragging page elements and moving them around; stores positions across requests (to disable, remove div#* keys from localStorage or set makeOriginalDivsDraggable to false,  line #30
//       if trackMySales enabled, stores info about downloaded images in local storage; objective: create arrival rate distribution

'use strict';

var useShortCountryName = false;       // US (true), or United States of America (false) - false is now default as it looks nicer :)
var googleMaps = "https://www.google.com/maps/place/"; 
var displayEarnings = true; // set to false to disable display of earnings for last 7 days and today on top of popup
var displayRecentEarnings = true; // set to false to disable display of earnings for recent images 
var makeOriginalDivsDraggable = true; // makes content on front page draggable, you can move sections around (map, track your sets, graphs, content overview, profile, forum and blog
var removeRedUploadButton = true; // makes content on front page draggable, you can move sections around (map, track your sets, graphs, content overview, profile, forum and blog


var debug = false; // easier for me during development
var trackMySales = false; // for future development, saves info on individual sales in local storage

//===================================


var $j = jQuery.noConflict();
var div;

$j(document).ready(function() {
    createStyles();   
    var containerDiv = document.createElement('div');
    containerDiv.id = "dragContainer";
    $j("div.container-fluid").append(containerDiv);
    
    div = document.createElement('div');
    div.id = "ggDL";
    $j("div#dragContainer").append(div);
    
    if (localStorage.getItem("positionDownloadLocations")) { 
        var position = $j.parseJSON(localStorage.getItem("positionDownloadLocations"));
        $j("div#dragContainer").css({
            top: position.top,
            left: position.left});
    } 
    
    $j("div#dragContainer").draggable({
        opacity: 0.9,
        handle: "div",
        stop: function(event, ui){
            localStorage.setItem("positionDownloadLocations", JSON.stringify(ui.position));
        }
    });
    $j("div#ggDL").hover( function() {$j(this).css("cursor", "move");}, function(){ $j(this).css("cursor", "default"); });

    localStorage.removeItem('lastDownloads'); // remove cached locations response on page refresh
    localStorage.removeItem('lastEarnings'); // remove cached locations response on page refresh,
    localStorage.removeItem('lastSevenDays'); // remove cached locations response on page refresh

    showLocations();

    (makeOriginalDivsDraggable) && makeDivsDraggable();
(removeRedUploadButton) && removeRedUpload();
    window.setInterval(showLocations,60000); // refresh every 60 seconds
    window.setInterval(retrieveEarnings,60000);
});

function removeRedUpload(){
    $j("div#images-primary").hide();
}

function makeDivsDraggable() {
    var divs = [ "div#content-overview-container", "div#public-info-container",  "div#earnings-summary-container", "div#resources-container", "div#track-sets-container", "div#unpaid-container", "div#download-map-container", "div#top-earners-container", "div#earnings-summary-graph-container"];

    $j("div.row.row-eq-height:first > div.col-md-6:last > div").wrap("<div id='unpaid-container'></div>");
    
    divs.forEach( function(entry) {
        $j(entry).draggable({
            cursor: "move",
            stop: function(event, ui){
                localStorage.setItem(entry, JSON.stringify(ui.position));
            }
        }); // to hide them, use .hide() instead of draggable()

        if (localStorage.getItem(entry)) { 
            var position = $j.parseJSON(localStorage.getItem(entry));
            $j(entry).css('top', position.top + "px");
            $j(entry).css('left', position.left + "px");
        }
    }
                );
}


function existsInLocalStorage(key, data) {
    var thisResponseHash = CryptoJS.MD5(data).toString(CryptoJS.enc.Base64);
    if (localStorage.getItem(key) == thisResponseHash) {
        if (debug) { console.log("No change in " + key + ": " + thisResponseHash); };
        return true;
    }
    else {
        localStorage.setItem(key, thisResponseHash);
        if (debug) { console.log("Inserting into " + key + ": " + thisResponseHash); }
        return false;
    }
}

function showLocations() {


    $j.ajax({
        url: window.location.protocol + '//submit.shutterstock.com/show_component.mhtml?component_path=download_map/recent_downloads.mh',
        type: "get",
        dataType: "html",
        error: function (request, status, error) {
            //alert(request.responseText);
        },
        success: function( data ){
            if (existsInLocalStorage('lastDownloads', data)) {
                retrieveEarnings();
                $j("div.refreshCoords").text("Refresh");
                return true;
            }

            var coords = $j.parseJSON(data);
            localStorage.removeItem('lastSevenDays'); 

            div.innerHTML = "<span class=\"refreshCoords\">Refresh</span>";

            if (displayEarnings){
                div.innerHTML += "<H4>Earnings</h4>";
                retrieveLastWeekEarnings();
                div.innerHTML += "Last 7 days: <span id=\"last7\"></span>$<br />";
                div.innerHTML += "Today: <span id=\"today\"></span>$<br />";
                //      div.innerHTML += "Lifetime: <span id=\"lifetime\"></span>$<br />";
                //      div.innerHTML += "Unpaid: <span id=\"unpaid\"></span>$<br />";
            }

            div.innerHTML += "<h4>Download locations</h4>";

            $j.each(coords, function( ind, el ) {
                var id = el.media_id;
                var img = el.thumb_url;
                var time = el.time;
                var loc;

                if (el.latitude !== null && el.longitude !== null) {
                    $j.ajax({
                        url: 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' + el.latitude + ',' + el.longitude,
                        type: "get",
                        dataType: "html",
                        error: function (request, status, error) {
                            console.log(request.responseText);
                        },
                        success: function( data ){
                            var res = $j.parseJSON(data);
                            // moramo ovako jer je asinkrono. dok u divu ispise tekst, ovo jos nije stiglo sa servera
                            if (res.status == "OK") {
                                $j("a.location" + id + "-" + time).text(ExtractLocation(res.results[0].address_components));
                            } 
                            else {
                                $j("a.location" + id + "-" + time).text("Can't convert to location :\(");
                            }

                        }  
                    }); 

                }
                if (trackMySales) {
                    localStorage.setItem(id + "-" + time, JSON.stringify(el)); // save image info, key = (id-time_of_download);
                }

                if (debug) { console.log("Added " + id + "to local storage"); }

                // if it's footage, need to change thumbnail size; too bad i can't test it with 1 footage a century
                var footageWidth = "";
                if (el.media_type != "photo") {
                    footageWidth = "width=\"100px\" height=\"59\" ";
                }
                div.innerHTML += "<a target=\"_new\" href=\"http://www.shutterstock.com/pic.mhtml?id=" + id + "\"><img " + footageWidth + "src=\"" + img + "\" /></a><br />";

                if (el.latitude  && el.longitude ) {
                    div.innerHTML +=  "<a class=\"location" + id +  "-" +  time + "\" target=\"_new\" href=\"" + googleMaps + el.latitude + "+"+ el.longitude + "\"></a><br />";
                }
                else {
                    div.innerHTML += "Unknown, middle of Atlantic :)<br />";
                }

                var n =  new Date().getTimezoneOffset() / 60; // offset from GMT
                // taking only time from date - 6+n - NY time + offset from GMT gives local - works wine for me
                var t = new Date((time + (6+n) * 3600) *1000).toTimeString().split(" ")[0]; 
                if (displayRecentEarnings) {
                    div.innerHTML += "Earnings: <span id=\"earnings" + id + time + "000\">N/A</span><br />";
                    if (debug) {console.log(time)};
                }
                div.innerHTML += "Time: " + t + "<hr />";
            });


            $j("span.refreshCoords").on("click", function() {
                $j("span.refreshCoords").text("Refreshing...");
                showLocations(); 
            });

            localStorage.removeItem('lastEarnings');
            retrieveEarnings();

        }
    });
}

function retrieveLastWeekEarnings(){
    $j.ajax({
        url: window.location.protocol + '//submit.shutterstock.com/show_component.mhtml?component_path=mobile/comps/earnings_overview.mj',
        type: "get",
        dataType: "html",
        error: function (request, status, error) {
            console.log(request.responseText);
        },
        success: function( data ){
            if (existsInLocalStorage('lastSevenDays', data)) {
                retrieveEarnings();
                $j("div.refreshCoords").text("Refresh");
                return true;
            }
            var res = $j.parseJSON(data);  
            // moramo ovako jer je asinkrono. dok u divu ispise tekst, ovo jos nije stiglo sa servera
            if (res.last_7_days) {
                $j("span#last7").text(res.last_7_days);
            }
            if (res.day) {
                $j("span#today").text(res.day);
            }
            //      if (res.unpaid) {
            //          $j("span#unpaid").text(res.unpaid);
            //      }
            //      if (res.lifetime) {
            //          $j("span#lifetime").text(res.lifetime);
            //      }
        }  
    }); 
}
// retreive earnings for last 7 days for each image: http://submit.shutterstock.com/show_component.mhtml?component_path=mobile/comps/earnings_list.mj
// and put that info in the appropriate DIV

function retrieveEarnings(){
    if (displayRecentEarnings) {
        $j.ajax({
            url: window.location.protocol + '//submit.shutterstock.com/show_component.mhtml?component_path=mobile/comps/earnings_list.mj',
            type: "get",
            dataType: "html",
            error: function (request, status, error) {
                console.log(request.responseText);
            },
            success: function( data ){

                if (existsInLocalStorage('lastEarnings', data)) {
                    $j("span.refreshCoords").text("Refresh");
                    return true;
                }

                var res = $j.parseJSON(data);  

                var day=0; // retrieve for today, will increase if <10 dls today
                var retrievedImages = 0; // count number of retrieved, stop at 10

                while (retrievedImages < 10) {
                    var downloads = res[day].downloads;
                    $j.each(downloads, function (ind, el) {
                        var imageID = el.photo_id;
                        var earnings = el.payout;
                        var date = el.download_date;
                        if (debug) {console.log("ID: " + imageID + ", Earnings: " + earnings + ", Date: " + date)};
                        $j("span#earnings" + imageID + date ).text(earnings + "$");
                        retrievedImages++;
                        if (retrievedImages >= 10) return false;
                    });
                    day++;
                    if (debug) console.log(day, retrievedImages);
                }

            }
        }); 
    }
}





// following code created by https://gist.github.com/satinka/5479a93d389a07d41246

function ExtractLocation(details) { // created by https://gist.github.com/satinka/5479a93d389a07d41246
    var loc = "";
    var country = "";
    var locality = "";
    var admin_area1 = "";
    var admin_area2 = "";

    $j.each(details, function( ind, el ) {
        if ($j.inArray("country", el.types) != -1) 
            country = useShortCountryName ? el.short_name : el.long_name;
        if ($j.inArray("locality", el.types) != -1) 
            locality = el.long_name;
        if ($j.inArray("administrative_area_level_1", el.types) != -1) 
            admin_area1 = el.short_name;
        if ($j.inArray("administrative_area_level_2", el.types) != -1) 
            admin_area2 = el.long_name;
    });
    loc = loc + ((locality !== "") ? locality + ", " : "") +
        ((admin_area2 != "") ? admin_area2 + ", " : "") +
        ((admin_area1 != "") ? admin_area1 + ", " : "") +
        ((country !== "") ? country : "");
    return loc;
}

function createStyles() {
    var sheet = (function() {
        var style = document.createElement("style");
        style.appendChild(document.createTextNode(""));
        document.head.appendChild(style);
        return style.sheet;
    })(); 
    var refreshCoords = "cursor: hand; cursor: pointer; text-decoration: underline;";

    var ggDL = "position: fixed; top: 60px; left: 50px; width: 200px; height: 95%; overflow: auto; z-index:3;" +
        "border: 1px solid #eeeeee; background-color: white; resize: both;" +
        "font-size: 11px;" +
        "padding: 2px 3px 0 5px;" + 
        "text-shadow: 0 0 5px #fff; text-align: left;";

    //   var map = "position: fixed; top: 60px; left: 320px; width: 1000px; height: 95%; overflow: auto; background-color: #eeeeee;";
    addCSSRule(sheet, "div#dragContainer", ggDL, 0);
    addCSSRule(sheet, "span.refreshCoords", refreshCoords, 0);
}

function addCSSRule(sheet, selector, rules, index) {
    if("insertRule" in sheet) {
        sheet.insertRule(selector + "{" + rules + "}", index);
    }
    else if("addRule" in sheet) {
        sheet.addRule(selector, rules, index);
    }
}

function sortByKey(array, key) {
    return array.sort(function(a, b) {
        var x = a[key]; var y = b[key];
        return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });
}