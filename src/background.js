'use strict';
localStorage.config && (JSON.parse(localStorage.config).offline !== undefined) && (JSON.parse(localStorage.config).history !== undefined) && (JSON.parse(localStorage.config).deleteMails !== undefined)
|| (localStorage.config = JSON.stringify({soundRemind: true, popupRemind: true, offline: true, history: true, deleteMails: false}));

localStorage.friends || localStorage.setItem('friends', '{}');

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
    this.port = null;
    this.status = 'offline';
    this.sound = document.getElementById('alert');
    this.unread = [];
    this.history = {};
    this.mails = [];

    this.popInfo = null;

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


    if (JSON.parse(localStorage.config).offline) {
        this.timer = setInterval(self.proxy(this.receive, this), 60000);
    }

    chrome.extension.onConnect.addListener(this.proxy(this.portHandler, this));
    chrome.extension.onRequest.addListener(this.proxy(this.requestHandler, this));
    chrome.browserAction.onClicked.addListener(function(tab) {
        chrome.tabs.create({url: '../pages/douliao.html'});
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
        self.port = port;
        self.timer && clearInterval(self.timer);
        self.receive();
        self.timer = setInterval(self.proxy(self.receive, self), 10000);

        port.onMessage.addListener(function(msg) {
            switch (msg.cmd) {
            case 'send':
                self.send(
                    msg,
                    function (data, e) {
                        port.postMessage({cmd: 'sended', result: true});
                        JSON.parse(localStorage.config).history && self.save(msg.people, 'me', msg.content);
                    },
                    function (e) {console.log(e, e.status)
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
            case 'addFriend':
                var friends = JSON.parse(localStorage.getItem('friends'));
                if (friends[msg.people] === undefined) {
                    friends[msg.people] = msg;
                    delete msg.cmd;
                    delete msg.people;
                    localStorage.setItem('friends', JSON.stringify(friends));
                }
                break;
            }
        });

        port.onDisconnect.addListener(function (port) {
            if (port.name === 'dchat') {
                self.port = null;
                var config = JSON.parse(localStorage.config);

                if (config.deleteMails) {
                    self.delete(self.mails);
                    self.mails = [];
                }

                clearInterval(self.timer);console.log(config.offline, config)
                if (config.offline) {
                    self.timer = setInterval(self.proxy(self.receive, self), 60000);
                }
            }
        });
    }
};

Mail.prototype.requestHandler = function (request, sender, sendResponse) {
    var self = this;
    switch (request.cmd) {
    case 'createWindow':
        if (self.peopleInfo[request.people]) {
            chrome.tabs.update(self.peopleInfo[request.people].port.tab.id, {selected: true});
            self.setUnread(request.people);
        }
        else {
            self.popInfo = {
                people: request.people,
                name: request.name,
                icon: request.icon,
                sign: request.sign,
                me: self.me
            };

            chrome.windows.getLastFocused(function (win) {
                chrome.windows.create({
                    url: '../pages/pop.html#' + request.people,
                    width: 400,
                    height: 430,
                    left: win.left + Math.floor((win.width - 400) / 2),
                    top: win.top + Math.floor((win.height - 430) / 2),
                    type: 'popup'
                });
            });

            if (request.updateFriend) {
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
    case 'getPeopleInfo':
        var i = 0, res, history = [], mails = [];
        res = self.setUnread(request.people);
        for (; i < res.length ; i += 1) {
            history.push({name: res[i].name, content: res[i].content});
            mails.push(res[i].mailId);
        }
        self.popInfo.history = history;
        self.popInfo.mails = mails;
        if (self.popInfo.name === undefined) {
            self.popInfo.name = res[0].name;
            self.popInfo.icon = res[0].icon;
            self.popInfo.sign = res[0].sign;
        }
        sendResponse(self.popInfo);
        self.popInfo = null;
        break;
    case 'getUnread':
        sendResponse({unread: self.unread});
        break;
    case 'initial':
        self.receive();
        sendResponse({me: self.me, friends: JSON.parse(localStorage.getItem('friends')), unread: self.unread});
        break;
    case 'deleteFriend':
        var friends = JSON.parse(localStorage.getItem('friends'));
        delete friends[request.people];
        localStorage.setItem('friends', JSON.stringify(friends));
        break;
    case 'getCaptcha':
        sendResponse({url: self.history[request.people].captcha.string});
        break;
    case 'sendHistory':
        self.history[request.people].captcha.string = request.string;
        console.log(self.history[request.people], request);
        self.send(self.history[request.people], function () {
            delete self.history[request.people];
        }, function (e) {
            if (e.status === 403) {
                self.history[people].captcha = {
                    token: /=(.+?)&amp;/.exec(e.responseText)[1],
                    string: /captcha_url=(.+)$/.exec(e.responseText)[1]
                };
                chrome.windows.create({
                    url: '../pages/captcha.html?' + request.people,
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

Mail.prototype.delete = function (mails) {
    if (mails.length > 0) {
        var entry = '<?xml version="1.0" encoding="UTF-8"?>'
        +'<feed xmlns="http://www.w3.org/2005/Atom" xmlns:db="http://www.douban.com/xmlns/" xmlns:gd="http://schemas.google.com/g/2005" xmlns:opensearch="http://a9.com/-/spec/opensearchrss/1.0/">', i, len;

            for (i = 0, len = mails.length ; i < len ; i += 1) {
            entry += '<entry><id>' + mails[i] + '</id></entry>';
        }

        entry += '</feed>';

        new Resource({
            url: 'http://api.douban.com/doumail/delete',
                method: 'post',
            data: entry,
            load: function () {},
            error: function () {console.log(arguments)}
        }).request();
    }
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
                        response.name = data.author.name['$t'];
                        response.icon = data.author.link[2] && data.author.link[2]['@href'];
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
                        response.content = str2;console.log(str1, '-------------------------------------------', str2)
                        if (self.port) {
                            self.port.postMessage(response);
                        }
                        else {
                            self.unread.push(response);
                        }

                        self.mails.push(data.id['$t']);
                        JSON.parse(localStorage.config).history && self.save(response.people, 'ta', str2);
                        self.notify();
                    }
                }).request();
            }
        }
    }).request();
};

Mail.prototype.notify = function (people, info) {
    var config = JSON.parse(localStorage.config), notification;

    chrome.browserAction.setBadgeText({text: this.unread.length > 0 ? this.unread.length.toString() : ''});

    if (config.soundRemind) {
        this.sound.play();
    }

    if (config.popupRemind) {
        chrome.windows.getLastFocused(function (win) {
            if (win.focused) {
                chrome.tabs.getSelected(win.id, function (tab) {
                    if (self.port === null || self.port.tab.id !== tab.id) {
                        notification = webkitNotifications.createNotification('../assets/icon16.png', info.name + '说', info.content);
                        notification.show();
                        setTimeout(function () {
                            notification.cancel();
                        }, 3000);
                    }
                });
            }
            else {
                notification = webkitNotifications.createNotification('../assets/icon16.png', info.name + '说', info.content);
                notification.show();
                setTimeout(function () {
                    notification.cancel();
                }, 3000);
            }
        });
    }
}

Mail.prototype.save = function (people, from, content) {

};


oauth(function () {
    new Mail();
});
/*
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (tab.status !== 'complete' && /^http:\/\/www.douban.com\/people\/[^\/]+?\/?$/i.test(tab.url)) {
        chrome.tabs.executeScript(tabId, {file: "src/contentscript.js"});
    }
});
var i = 0;
        while (i < this.unread.length) {
            if (this.unread[i].people === people) {
                res = res.concat(this.unread.splice(i, 1));
            }
            else {
                i += 1;
            }
        }
*/
