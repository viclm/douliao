'use strict';
localStorage.config || (localStorage.config = JSON.stringify({soundRemind: true, popupRemind: true}));

function Resource(args) {
    this.method = args.method || 'get';
    this.url = args.url || '';
    this.params = args.params //this.setParams(args.params);
    this.data = args.data || null;
    this.load = args.load || function () {};
    this.error = args.error || function () {};
}

Resource.prototype.setParams = function (params) {
    var obj = {}, key;
    for (key in params) {
        obj[key] = params[key];
    }
    return obj;
}

Resource.prototype.oauth = function () {
    var message, self = this;
    message = {
        method: self.method,
        action: self.url,
        parameters: {
            oauth_consumer_key: window.localStorage.getItem('consumer_key'),
            oauth_token: window.localStorage.getItem('access_token'),
            oauth_signature_method: window.localStorage.getItem('signature_method'),
            oauth_signature: '',
            oauth_timestamp: '',
            oauth_nonce: ''
        }
    }

    OAuth.setTimestampAndNonce(message);
    OAuth.SignatureMethod.sign(message, {
        consumerSecret: window.localStorage.getItem('consumer_key_secret'),
        tokenSecret: window.localStorage.getItem('access_token_secret')
    });

    return OAuth.getAuthorizationHeader(message.action, message.parameters);
}

Resource.prototype.stringify = function (parameters) {
    var params = [];
    for(var p in parameters) {
        params.push(encodeURIComponent(p) + '=' + encodeURIComponent(parameters[p]));
    }
    return params.join('&');
},

Resource.prototype.request = function () {
    var xhr = new XMLHttpRequest(), self = this, data;
    //data = this.stringify(this.params);
    if (this.method.toLowerCase() === 'get' && this.data) {
        this.url += '?' + this.data;
    }
    xhr.onload = function (e) {
        if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304) {
            self.load.call(self, xhr.responseText, e);
        }
        else {
            self.error.call(self, xhr, e);
        }
    }
    xhr.onerror = function (e) {
        self.error.call(self, e);
    }
    xhr.open(this.method, this.url, true)
    xhr.setRequestHeader('content-type', 'application/atom+xml');
    xhr.setRequestHeader('Authorization', this.oauth());
    xhr.send(this.data);
}




function Mail(args) {

    var self = this;

    this.me = {};
	this.peopleInfo = {};
	this.peopleNum = 0;
    this.filterRegTest = /:[\r\n]+\|/m;
    this.filterRegFront = /^([\s\S]+?[\r\n])?[^\r\n]+?:[\r\n]+\|/m;
    this.filterRegBack = /^[\s\S]+[\r\n]\|.+?[\r\n]+([\s\S]+)$/m;

	this.timer = null;
    this.sound = document.getElementById('alert');
    this.unread = [];
	this.history = {};

	this.popInfo = undefined;

	new Resource({
        url: 'http://api.douban.com/people/%40me',
        method: 'get',
        data: 'alt=json',
        load: function (data) {
            data = JSON.parse(data);
            self.me = {
                id: data['db:uid']['$t'],
                name: data.title['$t'],
                icon: data['link'][2]['@href'],
                sign: data['db:signature']['$t']
            };
        }
    }).request();

    localStorage.friends || localStorage.setItem('friends', '{}');

    chrome.extension.onConnect.addListener(this.proxy(this.portHandler, this));

    chrome.extension.onRequest.addListener(this.proxy(this.requestHandler, this));

    chrome.tabs.onSelectionChanged.addListener(function (tabId, object) {
        if (self.peopleNum === 0) {return;}
        for (var key in self.peopleInfo) {
            if (tabId === self.peopleInfo[key].tab.id) {
                self.setUnread(key);
            }
        }
    });

    chrome.windows.onFocusChanged.addListener(function (windowId) {
        if (windowId === -1) {return;}
        chrome.tabs.getSelected(windowId, function (tab) {
            for (var key in self.peopleInfo) {
                if (tab.id === self.peopleInfo[key].tab.id) {
                    self.setUnread(key);
                }
            }
        });
    });
}

Mail.prototype.proxy = function (fn, obj) {
    return function () {
        return fn.apply(obj, arguments);
    }
};

Mail.prototype.portHandler = function(port) {
	var self = this;
    if (port.name === 'dchat') {
        port.onMessage.addListener(function(msg) {
            switch (msg.cmd) {
            case 'send':
                self.send(
                    msg,
                    function (data, e) {
                        port.postMessage({cmd: 'sended', result: true});
                    },
                    function (e) {
                        if (e.status === 403) {
                            port.postMessage({
                                cmd: 'sended',
                                result: false,
                                msg:{
                                    content: msg.content,
                                    people: msg.people,
                                    captcha: {
                                        token: /=(.+?)&amp;/.exec(e.responseText)[1],
                                        string: /captcha_url=(.+)$/.exec(e.responseText)[1]
                                    }
                                }
                            });
                        }
                    });
                break;
            case 'receivestart':
                if (self.peopleInfo[msg.people] === undefined) {
                    self.peopleNum += 1;
                    self.peopleInfo[msg.people] = {port: port, history: []};

                    port.onDisconnect.addListener(function (port) {
                        if (port.name === 'dchat') {
							var people = port.tab.url.match(/[\/#]([^\/#]+)\/?$/)[1], history = peopleInfo[people].history, content = '', i , len, item;
							for (i = 0, len = history.length ; i < len ; i += 1) {
								item = history[i];
								content += item.name + '说:\n' + item.content + '\n';
							}
							self.send(
								{people: self.me.id, content: content},
								function () {},
								function (e) {
									if (e.status === 403) {
										self.history[people] = {
											people: self.me.id,
											content: content,
											captcha: {
												token: /=(.+?)&amp;/.exec(e.responseText)[1],
												string: /captcha_url=(.+)$/.exec(e.responseText)[1]
											}
										};
										chrome.windows.create({
											url: '../pages/captcha.html?' + people,
											width: 500,
											height: 240,
											type: 'popup'
										});
									}
								}
							);
                            delete self.peopleInfo[people];
                            self.peopleNum -= 1;
                            if (self.peopleNum === 0) {
                                clearInterval(self.timer);
                                self.timer = null;
                            }
                        }
                    });
                }
                else {
                    chrome.tabs.update(self.peopleInfo[msg.people].tab.id, {selected: true});
                    port.postMessage({cmd: 'close'});
                }

                if (self.peopleNum > 0 && self.timer === null) {
                    self.receive();
                    self.timer = setInterval(self.proxy(self.receive, self), 10000);
                }
                port.postMessage({cmd: 'setStatus', status: msg.people in JSON.parse(localStorage.getItem('friends'))});
                break;
            case 'addFriend':
                var friends = JSON.parse(localStorage.getItem('friends'));
                if (friends[msg.people] === undefined) {
                    friends[msg.people] = msg;
                    delete msg.cmd;
                    delete msg.people;
                    localStorage.setItem('friends', JSON.stringify(friends));
                }
                break;
            case 'pop':
                self.popInfo = msg;
                chrome.windows.create({
                    url: '../pages/pop.html#' + msg.people + '/',
                    width: 400,
                    height: 430,
                    type: 'popup'
                });
                msg.me = self.me;
                delete msg.cmd;
                break;
            }
        });
    }
};

Mail.prototype.requestHandler = function (request, sender, sendResponse) {
	var self = this;
    switch (request.cmd) {
    case 'getUnread':
        sendResponse({unread: self.unread});
        break;
    case 'showUnread':
        if (self.peopleInfo[request.people]) {
            chrome.tabs.update(self.peopleInfo[request.people].tab.id, {selected: true});
            self.setUnread(request.people);
        }
        else {
            chrome.windows.create({
                url: '../pages/pop.html#' + request.people + '/',
                width: 400,
                height: 430,
                type: 'popup'
            });

            if (request.sign) {
                request.me = self.me;
                self.popInfo = request;
                new Resource({
                    url: 'http://api.douban.com/people/' + request.people,
                    method: 'get',
                    data: 'alt=json',
                    load: function (data) {
                        data = JSON.parse(data);
                        var friends = JSON.parse(localStorage.getItem('friends'));
                        friends[request.people] = {
                            name: data.title['$t'],
                            icon: data['link'][2]['@href'],
                            sign: data['db:signature']['$t']
                        };
                        localStorage.setItem('friends', JSON.stringify(friends));
                    }
                }).request();
            }
        }
        break;
    case 'getPop':
        var i = 0, res, history = [];
        res = self.setUnread(request.people);
        for (; i < res.length ; i += 1) {
            history.push({people: 'ta', content: res[i].content});
        }
        if (self.popInfo) {
            self.popInfo.history = self.popInfo.history.concat(history);
            sendResponse(self.popInfo);
            self.popInfo = undefined;
        }
        else {
            sendResponse({people: request.people, name: res[0].name, icon: res[0].icon, sign: res[0].sign, history: history, me: self.me});
        }
        break;
    case 'getList':
        self.receive();
        sendResponse({me: self.me, friends: JSON.parse(localStorage.getItem('friends'))});
        break;
    case 'deleteFriend':
        var friends = JSON.parse(localStorage.getItem('friends'));
        delete friends[request.people];
        localStorage.setItem('friends', JSON.stringify(friends));
        break;
	case 'getCaptcha':
		sendResponse({url: self.history[request.people]});
		break;
	case 'sendHistory'://here
		self.send(
			{people: self.me.id, content: content},
	function () {},
	function (e) {
		if (e.status === 403) {
			self.history[people] = {
				people: self.me.id,
				content: content,
				captcha: {
					token: /=(.+?)&amp;/.exec(e.responseText)[1],
					string: /captcha_url=(.+)$/.exec(e.responseText)[1]
				}
			};
			chrome.windows.create({
				url: '../pages/captcha.html?' + people,
				width: 500,
				height: 240,
				type: 'popup'
			});
		}
	}
	);
		break;
    }
};

Mail.prototype.send = function (msg, load, error) {
    var entry = '<?xml version="1.0" encoding="UTF-8"?>'
    +'<entry xmlns="http://www.w3.org/2005/Atom" xmlns:db="http://www.douban.com/xmlns/" xmlns:gd="http://schemas.google.com/g/2005" xmlns:opensearch="http://a9.com/-/spec/opensearchrss/1.0/">'
        +'<db:entity name="receiver">'
    +'<uri>http://api.douban.com/people/' + msg.people + '</uri>'
        +'</db:entity>'
    +'<content>' + msg.content + '</content>'
    +'<title>通过豆聊发送的消息</title>'
    +(msg.captcha ? ('<db:attribute name="captcha_token">' + msg.captcha.token + '</db:attribute><db:attribute name="captcha_string">' + msg.captcha.string + '</db:attribute>') : '')
    +'</entry>', self;

    new Resource({
        url: 'http://api.douban.com/doumails',
        method: 'post',
        data: entry,
        load: load,
        error: error
    }).request();
};

Mail.prototype.receive = function () {
    var self = this;
    new Resource({
        url: 'http://api.douban.com/doumail/inbox/unread',
        method: 'get',
        data: 'start-index=1&alt=json',
        load: function (data, e) {
            var i, len, key, people, mails = [];
            data = JSON.parse(data).entry;
            for (i = 0, len = data.length ; i < len ; i += 1) {
                new Resource({
                    url: data[i].id['$t'],
                    method: 'get',
                    data: 'alt=json',
                    load: function (data) {
                        data = JSON.parse(data);
                        var response = {}, str1, str2;
                        response.cmd = 'received';
                        response.people = data.author.link[1]['@href'].match(/\/([^\/]+)\/?$/)[1];
                        response.timestamp = data.published['$t'];

                        str1 = data.content['$t'].trim();
                        if (self.filterRegTest.test(str1)) {
                            str2 = self.filterRegFront.exec(str1)[1];
                            if (typeof str2 === 'undefined') {
                                str2 = self.filterRegBack.exec(str1)[1];
                                if (typeof str2 === 'undefined') {
                                    str2 = '';
                                }
                            }
                        }
                        else {
                            str2 = str1;
                        }
                        response.content = str2;console.log(str1, '++++', str2)
                        if (self.peopleInfo[response.people]) {
                            self.peopleInfo[response.people].port.postMessage(response);
                        }
                        JSON.parse(localStorage.config).soundRemind && self.sound.play();
                        chrome.windows.getLastFocused(function (win) {
                            if (win.focused) {
                                chrome.tabs.getSelected(win.id, function (tab) {
                                    if (!self.peopleInfo[response.people] || self.peopleInfo[response.people].tab.id !== tab.id) {
                                        //self.nofifyPop(data.author.name['$t'], str2);
                                        self.setUnread(response.people, {
                                            icon: data.author.link[2] && data.author.link[2]['@href'],
                                            name: data.author.name['$t'],
                                            content: str2,
                                            sign: ''
                                        });
                                    }
                                });
                            }
                            else {
                                //self.nofifyPop(data.author.name['$t'], str2);
                                self.setUnread(response.people, {
                                    icon: data.author.link[2] && data.author.link[2]['@href'],
                                    name: data.author.name['$t'],
                                    content: str2,
                                    sign: ''
                                });
                            }
                        });
                    }
                }).request();
            }
        }
    }).request();
};

Mail.prototype.nofifyPop = function (name, content) {
    var notification = webkitNotifications.createNotification('../assets/icon16.png', name + '说', content);
    notification.show();
    setTimeout(function () {
        notification.cancel();
    }, 3000);
};

Mail.prototype.setUnread = function (people, info) {
	var res = [];
    if (info === undefined) {
        var i = 0;
        while (i < this.unread.length) {
            if (this.unread[i].people === people) {
                res = res.concat(this.unread.splice(i, 1));
            }
            else {
                i += 1;
            }
        }
    }
    else {
        info.people = people;
        this.unread[this.unread.length] = info;
		res.push(info);
        if (JSON.parse(localStorage.config).popupRemind) {
            var notification = webkitNotifications.createNotification('../assets/icon16.png', info.name + '说', info.content);
            notification.show();
            setTimeout(function () {
                notification.cancel();
            }, 3000);
        }
    }
    var num = this.unread.length;
    chrome.browserAction.setBadgeText({text: num > 0 ? num.toString() : ''});
    chrome.browserAction.setPopup({popup: num > 0 ? '../pages/popup.html' : '../pages/list.html'});
	return res;
}


oauth(function () {
	var doumail = new Mail();
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (tab.status !== 'complete' && /^http:\/\/www.douban.com\/people\/[^\/]+?\/?$/i.test(tab.url)) {
        chrome.tabs.insertCSS(tabId, {file: 'pages/style/ui.css'});
        chrome.tabs.executeScript(tabId, {file: "src/dchat.js"});
    }
});
