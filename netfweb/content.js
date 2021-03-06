// Runs background script to aquire score from FilmWeb. Adds SPAN and fullfill it with data from storage.

/**
 * Send message to background.js to report the correctness of links to rating websites.
 * @param {string} idNetflix - title's netflix ID
 * @param {boolean} ok - true the link correct, otherwise false
 * @param {string} source - rating website id (fw - Filmweb, me - Metacritic, im - IMDb)
 */
function reportLinks(idNetflix, ok, source){
    chrome.runtime.sendMessage({type: "report", idNetflix: idNetflix, ok: ok, source: source});
}

/**
 * Clears storage entry regarding mapping between given title and website
 * @param {string} idNetflix - title's netflix ID
 * @param {string} source - rating website name (filmweb, metacritic, imdb)
 */
function clearMap(idNetflix, source){
    var itemJSON = JSON.stringify({'URL' : ''});
    var save = {};
    save[source+"_"+idNetflix] = itemJSON;
    chrome.storage.local.set(save);
}

/**
 * Clears storage entry regarding mapping between given title and website
 * @param {string} data - data read from storage
 * @return {json} - returns JSON object (with score and URL values)
 */
function getInfo(data){
    if(data){
        var infoJSON = JSON.parse(data);
        if(infoJSON.score == "0" || infoJSON.score == "" || infoJSON.score == undefined) infoJSON.score="?";
        return infoJSON;
    } else {
        return JSON.parse('{ "score": "?", "URL": ""}');
    }
}

/**
 * Place title's rating from one selected source on browsing page (that with multiply titles)
 * @param {string} titleName - title's name
 * @param {string} idNetflix - title's netflix ID
 * @param {string} filmBox - jquery object where information will be placed
 */
function placeScore(titleName, idNetflix, filmBox){
    /* Send message to background.js to prepare information about rating of selected title,
       all=1 - only for one, currently selected source website */
    chrome.runtime.sendMessage({type: "getScore", titleName: titleName, idNetflix: idNetflix, all: "1"});

//    if(filmBox.find('div.nfw_score').length == 0 || filmBox.find('div.nfw_score').text != '?'){
    if(filmBox.find('div.nfw_score').length == 0){
        filmBox.append("<div class='nfw_score title_"+idNetflix+"'></div>");
        if(!scoreSource) scoreSource='filmweb';
        var readStore = scoreSource+"_"+idNetflix;

        /* Read and place score from storage */
        chrome.storage.local.get(readStore, function(data) {
            filmBox.find(".nfw_score").html(getInfo(data[readStore]).score.toLocaleString());
        });
    }
}

/**
 * Place title's ratings from all sources on title's detail page
 * @param {string} titleName - title's name
 * @param {string} idNetflix - title's netflix ID
 * @param {string} filmBox - jquery object where information will be placed
 */
function placeScoreJaw(titleName, idNetflix, filmBox){
    chrome.runtime.sendMessage({type: "getScore", titleName: titleName, idNetflix: idNetflix, all: "0"});

    filmBox.before("<div class='nfw_score_jaw'><img class='nfw_wrong' src='"+chrome.extension.getURL("/wrong.png")+"'> <img src='"+chrome.extension.getURL("/star.png")+"'><div id='nfw_report_a'><div id='nfw_report'></div></div> </div>");
    filmBox.before("<div class='nfw_related'><a href='https://www.netflix.com/search?q=%20&suggestionId="+idNetflix+"_video'>related titles...</a></div>");
    destBox = filmBox.parent().find('.nfw_score_jaw');

    /* Reporting information about correctness of links to websites with ratings */
    destBox.find(".nfw_wrong").click(function(){
        $nfw_report=$(this).parent().find('#nfw_report');
        if($nfw_report.html()){
            var save = {};
            save['clipboard'] = {idNetflix: idNetflix, title: titleName};
            chrome.storage.local.set(save);
            $nfw_report.css("display", "block");
        }
        $(this).remove();
    });

    var params = {};
    params["filmweb"] = { "URL": "http://www.filmweb.pl/search?q=", "shortcut": "fw", "name": "Filmweb"};
    params["metacritic"] = { "URL": "http://www.metacritic.com/search/all/", "URL2": "/results?cats%5Bmovie%5D=1&cats%5Btv%5D=1&search_type=advanced", "shortcut": "me", "name": "Metacritic"};
    params["imdb"] ={ "URL": "http://www.imdb.com/find?ref_=nv_sr_fn&s=all&q=", "shortcut": "im", "name": "IMDb"};
    params["tmdb"] = { "URL": "https://www.themoviedb.org/search?query=", "shortcut": "tm", "name": "TheMovieDB"};
    Object.keys(params).forEach(function(source){
      var readStore = source+"_"+idNetflix;
      chrome.storage.local.get(readStore, function(data) {
          var infoJSON = getInfo(data[readStore]);
          var sourceURL = infoJSON.URL;
          if(!sourceURL && source != 'nflix') {
            sourceURL=params[source].URL+encodeURIComponent(titleName).replace("'","%27");
            if(params[source].URL2) sourceURL+=params[source].URL2;
          }

          destBox.append(" <a target='_blank' class='nfw_jaw_link link_"+readStore+"' href='"+sourceURL+"'>&nbsp;"+params[source].name+"&nbsp;<span class='title_"+readStore+"'>"+infoJSON.score+"</span></a>&nbsp;<img src='"+chrome.extension.getURL("/star.png")+"'> ");
          if(source != 'nflix'){
            if(infoJSON.v!=1) {
                destBox.find('#nfw_report').append("<div id='ntw_"+params[source].shortcut+"_report'>"+params[source].name+"&nbsp;<img id='ntw_"+params[source].shortcut+"_ok' class='nfw_button' src='"+chrome.extension.getURL("/ok.png")+"'>&nbsp;<img id='ntw_"+params[source].shortcut+"_wrong' class='nfw_button' src='"+chrome.extension.getURL("/wrong.png")+"'> </div>");
                destBox.find('#ntw_'+params[source].shortcut+'_ok').click(function(){
                    reportLinks(idNetflix, true, params[source].shortcut);
                    destBox.find('#ntw_'+params[source].shortcut+'_report').remove();
                });
                destBox.find('#ntw_'+params[source].shortcut+'_wrong').click(function(){
                    reportLinks(idNetflix, false, params[source].shortcut);
                    clearMap(idNetflix, source);
                    destBox.find('#ntw_'+params[source].shortcut+'_report').remove();
                });
            }
          }
      });
    })
}

/*
 * Listens to changes in data storege and changes information about ratings
 */
chrome.storage.onChanged.addListener(function(changes, namespace) {
    titleName=score="";
    for (key in changes) {
        if(key!="scoreSource"){
            var storageChange = changes[key];
            idNetflix=key.replace(scoreSource+"_","");
            data=storageChange.newValue;

            if(key.match(scoreSource)){
                $(".title_"+idNetflix).each(function(){
                    $(this).html(getInfo(data).score.toLocaleString());
                });
            }

            $(".title_"+key).each(function(){
                $(this).html(getInfo(data).score.toLocaleString());
            });

            $(".link_"+key).each(function(){
                $(this).attr('href',getInfo(data).URL);
            });
        }
    }
});


var scoreSource='filmweb';  // Default ratings source website
var readStore = "scoreSource";
chrome.storage.local.get(readStore, function(data) {
    if((data !== undefined) && (data[readStore] !== undefined)) scoreSource = data[readStore];

    // For all displayed titles
    $('.title-card').each(function(){
        titleName = $(this).find('.video-preload-title-label:first').text();  // Gets the title's name
        if(titleName){
            idNetflix = $(this).find('a').attr('href').replace(/\/watch\/([0-9]*).*/,"$1"); // Gets the title's netflix ID
            placeScore(titleName,idNetflix, $(this));
        }
    });

    // For selected title (details view)
    $('.jawBoneContainer').each(function(){
        titleName=$(this).find('div.title').text();
        if(!titleName){
            titleName=$(this).find('img.logo').attr('alt');
        }
        idNetflix = $(this).find('a').attr('href').replace(/\/title\/([0-9]*).*/,"$1");
        if(titleName) {
            if($(this).find('div.jawbone-actions')) placeScoreJaw(titleName, idNetflix, $(this).find('div.jawbone-actions'));
            else placeScoreJaw(titleName, idNetflix, $(this).find('div.actionsRow'));
        }
    });
});



// Allows to monitor changes in DOM.
var observer = new MutationObserver(function( mutations ) {   // based on https://gabrieleromanato.name/jquery-detecting-new-elements-with-the-mutationobserver-object/
  mutations.forEach(function( mutation ) {
    var newNodes = mutation.addedNodes; // DOM NodeList
    if( newNodes !== null ) { // If there are new nodes added
    	var $nodes = $( newNodes ); // jQuery set
    	$nodes.each(function() {
            if($(this).attr('class') !== undefined){

                // For all displayed titles
                $(this).find('.title-card-container').each(function(){
                    titleName = $(this).find('.video-preload-title-label:first').text();
                    idNetflix = $(this).find('a').attr('href').replace(/\/watch\/([0-9]*).*/,"$1");
                    if(idNetflix) {
                        placeScore(titleName,idNetflix, $(this));
                    }
                });

                // For selected title (details view)
                if($(this).attr('class').match(/jawBone(FadeInPlaceContainer|Container|OpenContainer)/)){
                    titleName=$(this).find('div.title').text();
                    if(!titleName){
                        titleName=$(this).find('img.logo').attr('alt');
                    }
                    idNetflix = $(this).find('a').attr('href').replace(/\/title\/([0-9]*).*/,"$1");
                    if(idNetflix) {
                        if($(this).find('div.jawbone-actions').length > 0) placeScoreJaw(titleName, idNetflix, $(this).find('div.jawbone-actions'));
                        else placeScoreJaw(titleName, idNetflix, $(this).find('div.actionsRow'));
                    }
                }
            }
    	});
    }
  });
});

// Configuration of the MutationObserver:
var config = {
	childList: true,
	subtree: true,
  characterData: true
};

// Pass in the target node, as well as the observer options
var target = $('#appMountPoint')[0];
observer.observe(target, config);
