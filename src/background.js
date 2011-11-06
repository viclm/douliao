'use strict';
localStorage.config || (localStorage.config = JSON.stringify({soundRemind: true, popupRemind: true}));
var c = JSON.parse(localStorage.config);
if (c.offline === undefined) {c.offline = true; localStorage.config = JSON.stringify(c)};
//if (c.history === undefined) {c.history = true; localStorage.config = JSON.stringify(c)};
if (c.deleteMails === undefined) {c.deleteMails = false; localStorage.config = JSON.stringify(c)};
if (c.keyboardFlip === undefined) {c.keyboardFlip = true; localStorage.config = JSON.stringify(c)};

if (!localStorage.friends) {
    localStorage.setItem('friends', '{}');
    chrome.tabs.create({url: '../pages/demo.html'});
}

var database = openDatabase('dchat', '1.0', 'dchat database', 5 * 1024 * 1024);
database.transaction(function (tx) {
    tx.executeSql('DROP TABLE IF EXISTS history');
    tx.executeSql('CREATE TABLE IF NOT EXISTS historyx (people text, f text, content text, timestamp text)');
});


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
    this.people = {};
    this.friends = JSON.parse(localStorage.friends);
    this.isUpdateFriends = false;
    this.filterRegTest = /:[\r\n]+\|/m;
    this.filterRegFront = /^([\s\S]+?[\r\n])?[^\r\n]+?:[\r\n]+\|/m;
    this.filterRegBack = /^[\s\S]+[\r\n]\|.+?[\r\n]+([\s\S]+)$/m;

    this.timer = null;
    this.port = null;
    this.joinInfo = null;
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
    chrome.tabs.onSelectionChanged.addListener(function(tabId) {
        if (self.port && self.port.tab.id === tabId) {
            self.unread = [];
            chrome.browserAction.setBadgeText({text: ''});
        }
    });
    chrome.windows.onFocusChanged.addListener(function(winId) {
        if (winId === -1) {
            return;
        }
        chrome.tabs.getSelected(winId, function (tab) {
            if (self.port && self.port.tab.id === tab.id) {
                self.unread = [];
                chrome.browserAction.setBadgeText({text: ''});
            }
        });
    });
    chrome.browserAction.onClicked.addListener(function(tab) {
        if (self.port === null) {
            chrome.tabs.create({url: '../pages/douliao.html'});
        }
        else {
            chrome.tabs.update(self.port.tab.id, {selected: true});
            self.unread = [];
            chrome.browserAction.setBadgeText({text: ''});
        }
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
        //if (!self.isUpdateFriends) {
            //self.isUpdateFriends = true;
            //self.updateFriends();
        //}

        port.onMessage.addListener(function(msg) {
            switch (msg.cmd) {
            case 'send':
                self.send(
                    msg,
                    function (data, e) {
                        port.postMessage({cmd: 'sended', result: true});
                        self.save(msg.people, 'me', msg.content, 'now');
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
            case 'addFriend':console.log(msg.url)
                new Resource({
                    url: msg.url.replace('www', 'api').slice(0, -1),
                    method: 'get',
                    data: 'alt=json',
                    load: function (data) {
                        var person;
                        data = JSON.parse(data);
                        person = {
                            people: data['db:uid']['$t'],
                            name: data.title['$t'],
                            icon: data['link'][2]['@href'],
                            sign: data['db:signature']['$t']
                        };
                        if (self.friends[person.people] === undefined) {
                            self.friends[person.people] = person;
                            localStorage.friends = JSON.stringify(self.friends);
                            person.cmd = 'join';
                            port.postMessage(person);
                        }
                    }
                }).request();
                break;
            case 'updateFriend':
                new Resource({
                    url: 'http://api.douban.com/people/' + msg.people,
                    method: 'get',
                    data: 'alt=json',
                    load: function (data) {
                        data = JSON.parse(data);
                        self.friends[data['db:uid']['$t']] = {
                            id: data['db:uid']['$t'],
                            name: data.title['$t'],
                            icon: data['link'][2]['@href'],
                            sign: data['db:signature']['$t']
                        };
                        localStorage.friends = JSON.stringify(self.friends);
                    }
                }).request();
                break;
            case 'addAllFriends':
                self.addAllFriends(1);
                break;
            case 'deleteFriend':
                delete self.friends[msg.people];console.log(self.friends, msg.people)
                localStorage.friends = JSON.stringify(self.friends);
                break;
            case 'fetchHistory':
                self.query(msg.people, null, null, msg.offset);
                break;
            case 'fetchMiniblog':
                self.queryMiniblog(msg.people, msg.offset, msg.latest);
                break;
            }
        });

        port.onDisconnect.addListener(function (port) {
            if (port.name === 'dchat') {
                self.port = null;
                var config = JSON.parse(localStorage.config);console.log(self.mails, config.deleteMails)

                if (config.deleteMails) {
                    self.delete(self.mails);
                    self.mails = [];
                }

                clearInterval(self.timer);
                self.timer = null;
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
    case 'join':
        if (self.port === null) {
            self.joinInfo = request;
            chrome.tabs.create({url: '../pages/douliao.html'});
        }
        else {
            self.port.postMessage(request);
            chrome.tabs.update(self.port.tab.id, {selected: true});
        }
        delete request.cmd;
        self.friends[request.people] = request;
        localStorage.friends = JSON.stringify(self.friends);
        break;
    /*    case 'setUnread':
        var i = 0;
        while (i < self.unread.length) {
            if (self.unread[i].people === request.people) {
                self.unread.splice(i, 1);
            }
            else {
                i += 1;
            }
        }
        chrome.browserAction.setBadgeText({text: this.unread.length > 0 ? this.unread.length.toString() : ''});
        break;*/
    case 'initial':console.log(self.friends)
        self.receive();
        sendResponse({me: self.me, friends: self.friends, current: self.joinInfo, unread: self.unread});
        self.joinInfo = null;
        self.unread = [];
        chrome.browserAction.setBadgeText({text: ''});
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

Mail.prototype.addAllFriends = function (index) {
    var self = this;
    new Resource({
        url: 'http://api.douban.com/people/' + self.me.id + '/contacts',
        method: 'get',
        data: 'alt=json&start-index=' + index + '&max-results=50',
        load: function (data) {
            var entry = JSON.parse(data).entry, friends = [], person, i = 0, len = entry.length, item;
            if (len === 50) {
                self.addAllFriends(index + 50);
            }
            for (; i < len ; i += 1) {
                item = entry[i];/*
                friends.push({
                people: item['db:uid']['$t'],
                name: item.title['$t'],
                icon: item['link'][2]['@href'],
                sign: item['db:signature']['$t']
                });*/
                person = {
                    people: item['db:uid']['$t'],
                    name: item.title['$t'],
                    icon: item['link'][2]['@href'],
                    sign: item['db:signature']['$t']
                };
                self.friends[person.people] = person;
                localStorage.friends = JSON.stringify(self.friends);
                person.cmd = 'join';
                person.active = false;
                self.port.postMessage(person);
            }
        }
    }).request();
};

Mail.prototype.updateFriends = function () {
    var key, counter = 1, self = this;
    for (key in self.friends) {
        (function () {
            var people = key;
            setTimeout(function () {
                new Resource({
                    url: 'http://api.douban.com/people/' + people,
                    method: 'get',
                    data: 'alt=json',
                    load: function (data) {
                        data = JSON.parse(data);
                        self.friends[data['db:uid']['$t']] = {
                            id: data['db:uid']['$t'],
                            name: data.title['$t'],
                            icon: data['link'][2]['@href'],
                            sign: data['db:signature']['$t']
                        };
                        localStorage.friends = JSON.stringify(self.friends);
                    }
                }).request();
            }, 50000 * counter);
        })();
        counter += 1;
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

Mail.prototype.receive = function () {console.log(Date())
    var self = this;
    new Resource({
        url: 'http://api.douban.com/doumail/inbox/unread',
        method: 'get',
        data: 'start-index=1&alt=json',
        load: function (data, e) {
            var i, len, key, people, mails = [];
            data = JSON.parse(data).entry;if (data.length > 1) {console.log(data.length)}
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

                        self.mails.push(data.id['$t']);
                        self.save(response.people, 'ta', str2, response.timestamp);
                        self.notify(response.name + '说: ', response.content, response);
                    }
                }).request();
            }
        }
    }).request();
};

Mail.prototype.queryMiniblog = function (people, offset) {
    var self = this;
    new Resource({
        url: 'http://api.douban.com/people/'+people+'/miniblog',
        method: 'get',
        data: 'start-index='+(offset+1)+'&max-results=10&alt=json',
        load: function (data, e) {
            var i, len, item, miniblog = [], photoReg = /photo\/(\d+)/, resReg;
            data = JSON.parse(data).entry;console.log(data)
            for (i = 0, len = data.length ; i < len ; i += 1) {
                item = {};
                item.content = data[i].content['$t'];
                item.timestamp = data[i].published['$t'];
				resReg = photoReg.exec(item.content);
				if (resReg) {
					item.photo = 'http://img3.douban.com/view/photo/photo/public/p' + resReg[1] + '.jpg';
				}
                miniblog.push(item);
            }
            self.port.postMessage({cmd: 'mergeMiniblog', people: people, miniblog: miniblog, final: len < 10, latest: offset === 0});
        }
    }).request();
};

Mail.prototype.notify = function (name, content, response) {
    var config = JSON.parse(localStorage.config), notification, self = this;

    if (config.soundRemind) {
        this.sound.play();
    }

    if (config.popupRemind) {
        chrome.windows.getLastFocused(function (win) {
            if (win.focused) {
                chrome.tabs.getSelected(win.id, function (tab) {
                    if (self.port === null || self.port.tab.id !== tab.id) {
                        self.unread.push(response);
                        chrome.browserAction.setBadgeText({text: self.unread.length > 0 ? self.unread.length.toString() : ''});
                        notification = webkitNotifications.createNotification('../assets/icon16.png', name, content);
                        notification.show();
                        setTimeout(function () {
                            notification.cancel();
                        }, 3000);
                    }
                });
            }
            else {
                self.unread.push(response);
                chrome.browserAction.setBadgeText({text: self.unread.length > 0 ? self.unread.length.toString() : ''});
                notification = webkitNotifications.createNotification('../assets/icon16.png', name, content);
                notification.show();
                setTimeout(function () {
                    notification.cancel();
                }, 3000);
            }
        });
    }
}

Mail.prototype.query = function (people, time, num, offset) {
    time = time || 0;
    num = num || 10;
    var self = this;
    database.transaction(function (tx) {
        tx.executeSql('SELECT * FROM historyx WHERE people=? ORDER BY timestamp DESC LIMIT ? OFFSET ?', [people, num, offset], function (tx, result) {
            var len = result.rows.length, i, history = [];
            for (i = 0; i < len; i += 1) {
                history.push(result.rows.item(i));
            }
            self.port.postMessage({cmd: 'mergeHistory', people: people, history: history, final: num !== len});
        }, function () {
            console.log(arguments)
        });
    });
};

Mail.prototype.save = function (people, from, content, timestamp) {
    database.transaction(function (tx) {
        tx.executeSql('INSERT INTO historyx VALUES (?,?,?,datetime(?, "localtime"))', [people, from, content, timestamp]);
    }, function (tx, e) {
        if (e.code === 4) {
            tx.executeSql('DELETE FROM historyx WHERE timestamp<datetime("now", "localtime", "-1 day")', [])
        }
    });
};


oauth(function () {
    new Mail();
});


chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    var config = JSON.parse(localStorage.config);
    if (tab.status === 'loading') {
        if (/^http:\/\/www.douban.com\/people\/[^\/]+?\/?$/i.test(tab.url)) {
            chrome.tabs.executeScript(tabId, {file: "src/contentscript.js"});
        }
        else if (config.keyboardFlip && /^http:\/\/www.douban.com\/group\/.*/i.test(tab.url)){
            chrome.tabs.executeScript(tabId, {file: "src/keyboardFlip.js"});
        }
    }
});


/*
*
*
    "content_scripts": [
        {
            "matches": ["http://www.douban.com/people/*"],
            "js": ["src/contentscript.js"]
        },
        {
            "matches": ["http://www.douban.com/group/*"],
            "js": ["src/keyboardFlip.js"]
        }
    ],
*
*
* */
