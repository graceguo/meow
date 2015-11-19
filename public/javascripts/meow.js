/**
 * Created by graceguo on 11/15/15.
 */
var CONSUMER_KEY = '42f433941f16edbaaecb3ef99064a283';
var CONSUMER_SECRET = '4eeb928ac5f5995a';
var OAUTH_CALLBACK = window.location.origin;
var PROXY_URL = OAUTH_CALLBACK + '/proxy';

var REQUEST_TOKEN_ENDPOINT = 'https://www.flickr.com/services/oauth/request_token';
var ACCESS_TOKEN_ENDPOINT = 'https://www.flickr.com/services/oauth/access_token';
var USER_AUTHORIZATION_ENDPOINT = 'https://www.flickr.com/services/oauth/authorize';
var SERVICES_URL = 'https://api.flickr.com/services/rest/';
var GET_LIST_METHOD = 'flickr.photosets.getList';
var GET_PHOTOS_METHOD = 'flickr.photosets.getPhotos';

var jsonFlickrApi = function(rsp) {
  if (rsp.stat != "ok"){
    return;
  }

  if (rsp.photosets && rsp.photosets.photoset.length) {
    var event = new CustomEvent("data-photosets", {
      detail: {photosets: rsp.photosets.photoset}
    });
    document.dispatchEvent(event);

  } else if (rsp.photoset && rsp.photoset.photo.length) {
    var event = new CustomEvent("data-photos", {
      detail: {photo: rsp.photoset.photo}
    });
    document.dispatchEvent(event);
  }
};

var XD = {
  get: function(url, data) {
    var requestURL = url + '?';
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        requestURL += (key + '=' + data[key] + '&');
      }
    }
    var scriptTag = document.createElement('script');
    scriptTag.src = requestURL;
    document.head.appendChild(scriptTag);
  },

  post: function(url, params, cb) {
    var messageIframe = document.getElementById('message-iframe');
    if (!messageIframe) {
      messageIframe = document.createElement('iframe');
      messageIframe.name = 'message-iframe';
      messageIframe.id = 'message-iframe';
      document.body.appendChild(messageIframe);
    }
    messageIframe.onload = function() {
      var container = messageIframe.contentWindow.document.getElementById('data-container');
      var dataStr = container.innerHTML;
      cb && cb(JSON.parse(dataStr));
    };

    var form = document.createElement('form');
    form.setAttribute('class', 'hiddenForm');
    form.action =  PROXY_URL;
    form.method = 'post';
    form.target = 'message-iframe';
    var requestURL = url + '?';

    for(var name in params) {
      if (params.hasOwnProperty(name)) {
        requestURL += name + '=' + params[name] + '&';
      }
    }
    var hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'requestURL';
    hiddenInput.value = requestURL;
    form.appendChild(hiddenInput);
    document.body.appendChild(form);
    form.submit();
  }
};

function signRequest(requestParams, endpoint, token_secret) {
  var sortedRequestParamNames = Object.keys(requestParams).sort();

  var base = 'GET&' + encodeURIComponent(endpoint) + '&';
  var i;
  var numParams = sortedRequestParamNames.length;
  var paramName;
  for(i = 0; i < numParams; i++) {
    paramName = sortedRequestParamNames[i];
    var currentParam = paramName + '=' + (requestParams[paramName]);
    if (i < numParams - 1) {
      currentParam += '&';
    }
    base += encodeURIComponent(currentParam);
  }

  var key = CONSUMER_SECRET + '&';
  if (token_secret) {
    key += token_secret;
  }
  var hash = CryptoJS.HmacSHA1(base, key);
  var hashInBase64 = CryptoJS.enc.Base64.stringify(hash);

  return hashInBase64;
}

function requestToken() {
  var requestParams = buildOauthParameters();
  var signature = signRequest(requestParams, REQUEST_TOKEN_ENDPOINT);
  requestParams.oauth_signature = encodeURIComponent(signature);

  var getUserAuthorization = function(response) {
    localStorage.setItem("TOKEN_SECRET", response.oauth_token_secret);

    var authorizationURL = USER_AUTHORIZATION_ENDPOINT + '?oauth_token=' + response.oauth_token;
    window.location.href = authorizationURL;
  };
  XD.post(REQUEST_TOKEN_ENDPOINT, requestParams, getUserAuthorization);
}

function getAccessToken() {
  var requestParams = buildOauthParameters();
  requestParams.oauth_verifier = getQueryParameter('oauth_verifier');
  requestParams.oauth_token = getQueryParameter('oauth_token');
  var signature = signRequest(requestParams, ACCESS_TOKEN_ENDPOINT, localStorage.getItem("TOKEN_SECRET"));
  requestParams.oauth_signature = encodeURIComponent(signature);

  var storeAccessToken = function(response) {
    var data = {
      oauth_token: response.oauth_token,
      oauth_token_secret: response.oauth_token_secret,
      user_nsid: decodeURIComponent(response.user_nsid),
      username: response.username,
      fullname: response.fullname
    };
    localStorage.setItem("meow_app", JSON.stringify(data));

    // Create the event
    var event = new CustomEvent("user-authorized");
    document.dispatchEvent(event);
  };
  XD.post(ACCESS_TOKEN_ENDPOINT, requestParams, storeAccessToken);
}

function getQueryParameter(name) {
  var params = {};
  var parts = window.location.search.substring(1).split('&');
  parts.forEach(function(part) {
    var pair = part.split('=');
    var key, value;
    if (pair && pair.length == 2) {
      key = pair[0];
      value = pair[1];
      params[key]= value;
    }
  });
  return params[name];
}

function buildOauthParameters() {
  var now = new Date();
  var requestParams = {};
  requestParams.oauth_callback = encodeURIComponent(OAUTH_CALLBACK);
  requestParams.oauth_consumer_key = CONSUMER_KEY;
  requestParams.oauth_nonce = new String(now.getTime()).substring(10);
  requestParams.oauth_timestamp = Math.round(now.getTime() / 1000.0);
  requestParams.oauth_signature_method = "HMAC-SHA1";
  requestParams.oauth_version = "1.0";

  return requestParams;
}

function getCallBackURL() {
  return window.location.protocol + window.location.host;
}

var Meow = function() {
  var photosets = [];
  var photos = {};
  var _this = this;

  var lightbox = document.getElementById('overlay');
  function openLightbox() {
    lightbox.style.visibility = "visible";
  }
  function closeLightbox() {
    lightbox.style.visibility = "hidden";
  }

  function populatePhotosets() {
    var userData = JSON.parse(localStorage.getItem('meow_app'));
    var requestParams = buildOauthParameters();
    requestParams.method = GET_LIST_METHOD;
    requestParams.user_id = userData.user_nsid;
    requestParams.format = 'json';
    requestParams.oauth_token = userData.oauth_token;
    var signature = signRequest(requestParams, SERVICES_URL, userData.oauth_token_secret);
    requestParams.api_sig = encodeURIComponent(signature);

    document.addEventListener("data-photosets", function(data) {
      photosets = data.detail.photosets;

      if (photosets.length) {
        showPhotosets();
      }
    });
    XD.get(SERVICES_URL, requestParams);
  }

  function populatePhotos() {
    var userData = JSON.parse(localStorage.getItem('meow_app'));
    var requestParams = buildOauthParameters();
    requestParams.method = GET_PHOTOS_METHOD;
    requestParams.user_id = userData.user_nsid;
    requestParams.photoset_id = _this.selectedPhotoset;
    requestParams.format = 'json';
    requestParams.oauth_token = userData.oauth_token;
    var signature = signRequest(requestParams, SERVICES_URL, userData.oauth_token_secret);
    requestParams.api_sig = encodeURIComponent(signature);

    document.addEventListener("data-photos", function(data) {
      photos[_this.selectedPhotoset] = data.detail.photo;

      if (photos[_this.selectedPhotoset].length) {
        showPhotos();
      }
    });
    XD.get(SERVICES_URL, requestParams);
  }

  function showPhotosets() {
    var container = document.getElementById('photosets');
    container.innerHTML = '';

    photosets.forEach(function(photoset) {
      var setTitle = photoset.title._content;
      var setCount = photoset.photos;
      var box = document.createElement('a');
      box.setAttribute('class', 'cell');
      box.setAttribute('id', photoset.id);
      box.setAttribute('href', '#');
      box.appendChild(document.createTextNode(setTitle));
      box.appendChild(document.createElement('br'));
      box.appendChild(document.createTextNode(
        setCount + ' photos'
      ));

      var list = document.createElement('li');
      list.setAttribute('class', 'photoset');
      list.appendChild(box);
      container.appendChild(list);
    });

  }

  function showPhotos() {
    if (!photos[_this.selectedPhotoset]) {
      populatePhotos();
    } else {
      var photosList = photos[_this.selectedPhotoset];

      var container = document.getElementById('photos-list');
      container.innerHTML = '';
      container.style.width = photosList.length * 280 + 'px';
      var viewport = document.getElementsByClassName('viewport')[0];
      viewport.scrollLeft = 0;

      photosList.forEach(function(photo){
        var img = document.createElement('img');
        img.src = 'https://' +
          'farm' + photo.farm + '.' +
          'staticflickr.com/' + photo.server + '/' +
          photo.id + '_' + photo.secret + '_m' + '.jpg';

        var imageBox = document.createElement('span');
        imageBox.setAttribute('class', 'image-box');
        imageBox.appendChild(img);

        var list = document.createElement('li');
        list.setAttribute('class', 'photo-item');
        list.appendChild(imageBox);
        container.appendChild(list);
      });
      openLightbox();
    }
  }

  this.init = function() {
    if (photosets || photosets.length == 0) {
      populatePhotosets();
    } else {
      showPhotosets();
    }

    // all click events
    var clickHdl = function(evt) {
      var evtTarget = evt.target;
      var evtType = evtTarget.getAttribute('class');

      if ('cell' === evtType) {
        evt.preventDefault();

        var evtId = evtTarget.getAttribute('id');
        _this.selectedPhotoset = evtId;
        showPhotos();
      } else if ('overlay' == evtType || 'close' == evtType) {
        closeLightbox();
      }
    };

    if (document.addEventListener)  // W3C DOM
      document.addEventListener('click',clickHdl,false);
    else if (document.attachEvent) { // IE DOM
      document.attachEvent("onclick", clickHdl);
    }
  }
};

function route() {
  if (getQueryParameter('oauth_verifier')) {
    getAccessToken();
  } else {
    requestToken();
  }
  //
  // Add an event listener
  document.addEventListener("user-authorized", function() {
    var meowApp = new Meow();
    meowApp.init();
  });
}

route();