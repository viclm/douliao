var oauth = (function () {
    'use strict';
    var api_key, api_key_secret, request_token, request_token_secret, access_token, access_token_secret, signature_method,
    request_token_uri, authorization_uri, access_token_uri, resources_uri, tab;

    api_key = '0d9e9cda9e4620fe28dbd68fdad262fa';
    api_key_secret = '8c956c0c3d4947b9',
    signature_method = 'HMAC-SHA1';
    request_token_uri = 'http://www.douban.com/service/auth/request_token';
    access_token_uri = 'http://www.douban.com/service/auth/access_token';
    authorization_uri = 'http://www.douban.com/service/auth/authorize';
    resources_uri = 'http://api.douban.com/people/%40me';

    function stringify(parameters) {
      var params = [];
      for(var p in parameters) {
        params.push(encodeURIComponent(p) + '=' +
                    encodeURIComponent(parameters[p]));
      }
      return params.join('&');
    };

    function getRequestToken(cb, fcb) {
        var message = {
            method: 'GET',
            action: request_token_uri,
            parameters: {
                oauth_consumer_key: api_key,
                oauth_signature_method: signature_method,
                oauth_signature: '',
                oauth_timestamp: '',
                oauth_nonce: ''
            }
        }

        OAuth.setTimestampAndNonce(message);
        OAuth.SignatureMethod.sign(message, {
            consumerSecret: api_key_secret
        })

        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
                    var responseObj = OAuth.getParameterMap(OAuth.decodeForm(xhr.responseText));
                    request_token = responseObj.oauth_token;
                    request_token_secret = responseObj.oauth_token_secret;
                    cb(request_token, request_token_secret);
                }
                else {
                    fcb(xhr);
                }
            }
        }
        xhr.open(message.method, message.action + '?' + stringify(OAuth.getParameterMap(message.parameters)), true);
        xhr.send(null);
    }
    function getUserAuthorizationURL() {
        return authorization_uri + '?oauth_token=' + request_token + '&oauth_callback=' + chrome.extension.getURL('pages/chrome_ex_oauth.html');
    }

    function getAccessToken(cb, fcb) {
        var message = {
            method: 'GET',
            action: access_token_uri,
            parameters: {
                oauth_consumer_key: api_key,
                oauth_token: request_token,
                oauth_signature_method: signature_method,
                oauth_signature: '',
                oauth_timestamp: '',
                oauth_nonce: ''
            }
        }

        OAuth.setTimestampAndNonce(message);
        OAuth.SignatureMethod.sign(message, {
            consumerSecret: api_key_secret,
            tokenSecret: request_token_secret,
        });

        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304) {
                    var responseObj = OAuth.getParameterMap(OAuth.decodeForm(xhr.responseText));
                    access_token = responseObj.oauth_token;
                    access_token_secret = responseObj.oauth_token_secret;
                    cb(access_token, access_token_secret);
                }
                else {
                    fcb(xhr);
                }
            }
        }
        xhr.open(message.method, message.action + '?' + stringify(OAuth.getParameterMap(message.parameters)), true);
        xhr.send(null);
    }

    function main(callback) {
	callback = callback || function () {};
        if (!localStorage.getItem('access_token')) {
            //chrome.browserAction.setBadgeText({text: 'auth'});
            getRequestToken(function () {
                chrome.tabs.create({
                    url: getUserAuthorizationURL()
                }, function (t) {
                    tab = t;
                });
            });

            chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
                if (request.greeting == "hello") {
                    //chrome.browserAction.setBadgeText({text: ''});
                    chrome.tabs.remove(tab.id);
                    getAccessToken(function () {
                        localStorage.setItem('consumer_key', api_key);
                        localStorage.setItem('consumer_key_secret', api_key_secret);
                        localStorage.setItem('access_token', access_token);
                        localStorage.setItem('access_token_secret', access_token_secret);
                        localStorage.setItem('signature_method', signature_method);
                        callback();
                    });
                }
            });
        }
        else {
            callback();
        }
    }

    return main;
})();
