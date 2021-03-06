// ==UserScript==
// @name         Shutterstock.EnhanceDashboard
// @namespace
// @version      2.0.1.2
// @updateURL    https://gist.github.com/PSOdAz/b353842718113287589c02938ca4b310/raw/a6690af21fee1f318f38661521e2b814837e18a5/Shutterstock.EnhanceDashboard.user.js
// @description  Show detailed localization and keyword used to download to Shutterstock Latest Downloads map, based on Satinka's https://gist.github.com/satinka/5479a93d389a07d41246 and GG update's https://gist.github.com/deymosD/ff4b0effbffefd76f58300b01e45afd4
// @author       Satinka, GG update, PSOdAz update
// @match        https://submit.shutterstock.com/dashboard*
// @copyright    2016, Satinka
// @require      http://code.jquery.com/jquery-latest.min.js
// @run-at      document-idle
// @require      https://code.jquery.com/ui/1.11.4/jquery-ui.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.2/rollups/md5.js
// @grant        none

// ==/UserScript==
/* jshint -W097 */

// NEWS
// v1.6: hashes SS response for location and image earnings
//       enables dragging page elements and moving them around; stores positions across requests (to disable, remove div#* keys from localStorage or set makeOriginalDivsDraggable to false,  line #30
//       if trackMySales enabled, stores info about downloaded images in local storage; objective: create arrival rate distribution
// v2.0.1.1 PSOdAz Show detailed localization and keyword used to download to Shutterstock Latest Downloads map, find image in use via google images search
// v2.0.1.2 PSOdAz Check popular keyword.

'use strict';

var useShortCountryName = false;       // US (true), or United States of America (false) - false is now default as it looks nicer :)
var googleMaps = "https://www.google.com/maps/place/";
var displayEarnings = false; // set to false to disable display of earnings for last 7 days and today on top of popup
var displayRecentEarnings = true; // set to false to disable display of earnings for recent images
var downloadedKeywords = true; //PSOdAz set to false to disable display downloaded keywords
var makeOriginalDivsDraggable = false; // makes content on front page draggable, you can move sections around (map, track your sets, graphs, content overview, profile, forum and blog
var removeRedUploadButton = true; // makes content on front page draggable, you can move sections around (map, track your sets, graphs, content overview, profile, forum and blog

var dragger = "#cee7f0"; // color of a dragging selection, if you don't like blue - change it; red looks cool :D

var debug = true; // easier for me during development
var trackMySales = true; // for future development, saves info on individual sales in local storage

var noStockSites = "-site:*.dreamstime.*+-site:*.shutterstock.*+-site:*.istockphoto.*+-site:*fotolia.*+-site:*.123rf.*+-site:*.veer.*+-site:*.istockphoto.*";

// not sure why they q= and oq= are used, but here are both :D, can't hurt; i could do it much nicer, maybe in the future... :)
// Google Images sometimes ignores excludes and will serve content from SS or other excluded sites
var googleSearch = "https://images.google.com/searchbyimage?q=" + noStockSites + "&oq=" + noStockSites + "&image_url=";


var timeout=1000;
//===================================


var $j = jQuery.noConflict();
var div;


var link = window.document.createElement('link');
link.rel = 'stylesheet';
link.type = 'text/css';
link.href = 'https://ajax.googleapis.com/ajax/libs/jqueryui/1.8/themes/smoothness/jquery-ui.css'; // get smoothness CSS; check http://jqueryui.com/themeroller/ for others, just change the theme name in url
document.getElementsByTagName("HEAD")[0].appendChild(link);                                       // other themes: http://rtsinani.github.io/jquery-datepicker-skins/, have fun!



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

    setTimeout(function(){
        (makeOriginalDivsDraggable) && makeDivsDraggable();
    }, timeout);

    (removeRedUploadButton) && removeRedUpload();
    window.setInterval(showLocations,60000); // refresh every 60 seconds
    // window.setInterval(retrieveEarnings,60000);
});

function removeRedUpload(){
    $j("div#images-primary").hide();
    $j("div#videos-primary").hide();
}

function makeDivsDraggable() {

    $j("div#referral-banner").hide();
    var divs = [  "div#public-info-container",  "div#earnings-summary-container", "div#resources-container", "div#track-sets-container", "div#unpaid-container", "div#download-map-container", "div#top-earners-container","div#content-overview-container", "div#earnings-summary-graph-container"];

    $j("div.row.row-eq-height:first > div.col-md-6:last > div").wrap("<div id='unpaid-container'></div>");

    $j(document).on('click', 'div.close', function() { // resort by downloads
        makeDivSmaller($j(this).parent());
    });

    divs.forEach( function(entry) {
        var close=document.createElement('div');
        close.className = "close";
        close.innerHTML="X";
        $j(entry).prepend(close);
        var drag = document.createElement('div');
        drag.className = "drag";
        drag.innerHTML="grab this to drag me";
        $j(entry).prepend(drag);

        /*
         $j(entry).resizable({
             resize: function (e, ui) {
        var wr = $(this).outerWidth()/$(this).data("width");
        var hr = $(this).outerHeight()/$(this).data("height");

        $(this).find("*").each(function (i, elm) {
            var w = $(elm).data("width") * wr;
            var h = $(elm).data("height") * hr;
            // Adjusting font size according to smallest ratio
            var f = $(elm).data("fontSize") * ((hr > wr) ? wr : hr);
            $(elm).css({
                "width": w,
                "height": h,
                "font-size": f
            });
        });
    },
         }
         );
        */

        $j(entry).draggable({
            cursor: "move",
            handle: "div.drag",
            stack:"div.drag",
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

function makeDivSmaller(obj) {
    console.log(obj);
    obj.hide();
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
        //url: window.location.protocol + '//submit.shutterstock.com/show_component.mhtml?component_path=download_map/recent_downloads.mh',
        url:  window.location.protocol + '//submit.shutterstock.com/api/user/downloads/map',
        type: "get",
        dataType: "html",
        error: function (request, status, error) {
            alert(request.responseText);
        },
        success: function( data ){
            //if(debug) {console.log(data);}
            if (existsInLocalStorage('lastDownloads', data)) {
                //sretrieveEarnings();
                $j("div.refreshCoords").text("Refresh");
                return true;
            }

            var coords = $j.parseJSON(data);

            localStorage.removeItem('lastSevenDays');

            div.innerHTML = "<span class=\"refreshCoords\">Refresh</span>";

            /*
            if (displayEarnings){
                div.innerHTML += "<H4>Earnings</h4>";
                retrieveLastWeekEarnings();
                div.innerHTML += "Last 7 days: <span id=\"last7\"></span>$<br />";
                div.innerHTML += "Today: <span id=\"today\"></span>$<br />";
                //      div.innerHTML += "Lifetime: <span id=\"lifetime\"></span>$<br />";
                //      div.innerHTML += "Unpaid: <span id=\"unpaid\"></span>$<br />";
            }
            */

            div.innerHTML += "<h4>Download locations</h4>";

            $j.each(coords, function( ind, el ) {
                var id = el.media_id;
                var img = window.location.protocol + '//image.shutterstock.com/mosaic_250/0/0/' + id + '.jpg';
                var time = el.time;
                var city = el.city;
                var country = el.country;
                var region = el.region;
                var gps = el.coordinates;
                var lat = gps[0];
                var long = gps[1];
                var loc;
                var imageInfo = [];
                var keywordSearch = " ";
                var table;

                if (trackMySales) {
                    localStorage.setItem(id + "-" + time, JSON.stringify(el)); // save image info, key = (id-time_of_download);
                }
                if (debug) { console.log("Added " + id + " to local storage"); }

                //PSOdAz store keyword
                $j.ajax({
                    url: window.location.protocol + '//submit.shutterstock.com/api/earnings/keywords?ids=' + id,
                    type: "get",
                    dataType: "html",
                    cache: true,

                    error: function(request, status, error) {
                        console.log(request.responseText);
                    },
                    success: function(data) {
                        imageInfo = $j.parseJSON(data);
                        imageInfo = imageInfo[0];
                        localStorage.setItem(id, JSON.stringify(imageInfo));
                        //localStorage.setItem(id, imageInfo);
                        //if (debug) { console.log("PSOdAz imageInfo " + JSON.stringify(imageInfo)); }
                    }
                });

                // if it's footage, need to change thumbnail size; too bad i can't test it with 1 footage a century
                var footageWidth = "";

                // if (el.media_type != "photo") {
                footageWidth = "width=\"130px\" ";
                // }

                div.innerHTML += "<a target=\"_new\" href=\"http://www.shutterstock.com/pic.mhtml?id=" + id + "\"><img " + footageWidth + "src=\"" + img + "\" /></a><br />";

                if (gps ) {
                    div.innerHTML +=  "<a class=\"location" + id +  "-" +  time + "\" target=\"_new\" href=\"" + googleMaps + lat + "+"+ long + "\">" + city + ", " + country + "</a><br />";
                }
                else {
                    div.innerHTML += "Unknown, middle of Atlantic :)<br />";
                }

                var t = new Date(time).toLocaleString('hr');
                div.innerHTML += "Time: " + t + "<br /> <br />";

                if (displayRecentEarnings) {
                    //div.innerHTML += "Earnings: <span id=\"earnings" + id + time + "000\">N/A</span><br />";

                    if (localStorage.getItem(id)) {
                        var downloadKeyword = localStorage.getItem(id);
                        if (debug) { console.log(downloadKeyword); }

                        var downloadKeyword = $j.parseJSON(downloadKeyword);
                        if (debug) { console.log(downloadKeyword); }

                        if (downloadKeyword.keywords.length > 0) {
                            //div.innerHTML += "<br /><b>Keywords used to download image:</b><br />";
                            table = "<table  width=\"200px\">";
                            table += "<thead><th align=\"right\">Keyword</th><th align=\"right\">% used</th></thead><tbody>";
                            var k = 0;
                            for (var j in downloadKeyword.keywords){
                                table += "<tr><th align=\"right\"> <a target=\"_new\" href=\"https://www.shutterstock.com/search?searchterm=" + downloadKeyword.keywords[k].keyword + "&search_source=base_search_form&page=1&sort=popular&image_type=photo\">" + downloadKeyword.keywords[k].keyword + "</a></td><th align=\"right\">" + parseFloat(downloadKeyword.keywords[k].percentage * 100).toFixed(2) + "</th></tr>";
                                keywordSearch += " " + (downloadKeyword.keywords[k].keyword);
                                k++;
                            }
                            table += "</tbody></table><br />";
                            div.innerHTML += table;
                            div.innerHTML += "<b>Check popular keywords:</b><br />";
                            div.innerHTML += "<a target=\"_new\" href=\"https://www.shutterstock.com/search?searchterm=" + keywordSearch + "&search_source=base_search_form&page=1&sort=popular&image_type=photo\"> ( " + keywordSearch + " )</a><br /><br />";
                            //if (debug) {console.log(time)};
                        } else {
                            div.innerHTML += "<b>No keyword info available.</b><br /><br />";
                        }
                    }

                    var editURL = window.location.protocol + "//submit.shutterstock.com/edit_media.mhtml?type=photos&approved=1&id=" + id;
                    div.innerHTML += "<a href=\"" + editURL + "\" target=\"_new\">Edit title and keywords</a>";

                    div.innerHTML += "<br /><a target=\"_new\" href =\"" + googleSearch + window.location.protocol + "//image.shutterstock.com/mosaic_250/0/0/" + id + ".jpg" + "\">Find image in use via Google Images</a><br />";
                    div.innerHTML += "<hr>";
                }
            });


            $j("span.refreshCoords").on("click", function() {
                $j("span.refreshCoords").text("Refreshing...");
                showLocations();
            });

            localStorage.removeItem('lastEarnings');
            //retrieveEarnings();
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
    var close="background-color: " + dragger + "; float: right; padding: 2px; font-size: 8px;z-index:20;";
    var drag="background-color: " + dragger + "; float: left; position:absolute; top:0; left:0; padding: 2px; font-size: 8px; z-index:20;";
    var dragHover = "cursor: move;";
    addCSSRule(sheet, "div#dragContainer", ggDL, 0);
    addCSSRule(sheet, "div.close", close, 0);
    addCSSRule(sheet, "div.drag", drag, 0);
    addCSSRule(sheet, "div.drag:hover", dragHover, 0);
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