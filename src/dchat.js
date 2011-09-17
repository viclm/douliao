(function (window, document, undefined) {

    function DChat(args) {
        this.sidebar = document.querySelector('#sidebar');
        this.content = document.querySelector('#content');
        this.friendsList = this.sidebar.querySelector('section');
        this.messageList = this.content.querySelector('section');
        this.textbox = this.content.querySelector('footer input[type=text]');

        this.current = null;
        this.me = null;
        this.friends = null;
        this.port = null;
        this.msgRequreToken = null;
        this.isLock = false;

        this.delegate(this.friendsList, '.entry', 'click', this.proxy(this.open, this));
        this.content.querySelector('header input').addEventListener('click', this.proxy(this.close, this), false);
        this.textbox.parentNode.addEventListener('submit', this.proxy(this.send, this), false);

        var self = this;
        chrome.extension.sendRequest({cmd: 'initial'}, function(response) {
            var friends = response.friends, key, div;

            for (key in friends) {
                div = document.createElement('div');
                div.className = 'entry';
                div.id = key;
                div.innerHTML = '<div><h2>' + friends[key].name + '</h2><p> ' + friends[key].sign + ' </p></div><img src="' + friends[key].icon + '" />';
                self.friendsList.appendChild(div);

                friends[key].unread = [];
            }

            self.me = response.me;
            self.friends = friends;
            self.start();

            if (response.current) {
                self.open({target: document.getElementById(response.current.people)});
            }
            self.receive.apply(self, response.unread);
        });
    }

    DChat.prototype.proxy = function (fn, obj) {
        return function () {
            return fn.apply(obj, arguments);
        }
    };

    DChat.prototype.delegate = function (node, selector, type, handler) {
        var result = /^([a-z]+)?(?:\.(.+))?$/.exec(selector), nodeName, className;
        nodeName = result[1];
        className = result[2];
        node.addEventListener(type, function (e) {
            var target = e.target;
            do {
                if ((nodeName === undefined || target.nodeName === nodeName) && (className === undefined || target.className === className)) {
                    delete e.target;
                    e.target = target;
                    handler(e);
                    break;
                }
                target = target.parentNode;
            }
            while (target !== this);
        }, false);
    };

    DChat.prototype.open = function (e) {
        var target = e.target, id = target.id, i, len, self = this;
        if (this.current !== id) {console.log(this.current, id)
            if (this.current) {
                this.friends[this.current].history = this.messageList.innerHTML;
            }
            this.messageList.innerHTML = this.friends[id].history || '';
            for (i = 0, len = this.friends[id].unread.length ; i < len ; i += 1) {
                this.addContent('<img src="' + this.friends[id].unread[i].icon + '"><p>' + this.friends[id].unread[i].content + '</p>', 'left');
                //this.lock(false);
            }
            if (len > 0) {
                this.friends[id].unread = [];
                target.querySelector('h2').removeChild(target.querySelector('h2 span'));
                chrome.extension.sendRequest({cmd: 'setUnread', unread: id});
            }

            if (this.current) {
                document.getElementById(this.current).className = 'entry';
            }
            else {
                this.content.style.left = '30%';
            }
            target.className = 'entry active';
            this.current = id;
        }
    };

    DChat.prototype.close = function () {
        var entry = document.getElementById(this.current);
        entry.className = 'entry';
        this.friends[this.current].history = this.messageList.innerHTML;
        this.current = null;
        this.content.style.left = '-40%';
    };

    DChat.prototype.start = function () {
        var self = this;
        this.port = chrome.extension.connect({name: 'dchat'});
        this.port.onMessage.addListener(function (msg) {
            switch (msg.cmd) {
            case 'sended':
                if (!msg.result) {
                    var captcha = self.addContent('<p>发送太快了亲，输入验证码</p><img src="' + msg.msg.captcha.string + '">', 'captcha');
                    self.msgRequreToken = msg.msg;
                    self.msgRequreToken.captcha.dom = captcha;
                    self.lock(false);
                }
                break;
            case 'received':
                delete msg.cmd;
                self.receive(msg);
                break;
            case 'join':
                delete msg.cmd;
                if (!self.friends[msg.people]) {
                    var div = document.createElement('div');
                    div.className = 'entry';
                    div.id = msg.people;
                    div.innerHTML = '<div><h2>' + msg.name + '</h2><p> ' + msg.sign + ' </p></div><img src="' + msg.icon + '" />';
                    self.friendsList.appendChild(div);
                    msg.unread = [];
                    self.friends[msg.people] = msg;
                }

                self.open({target: document.getElementById(msg.people)});
                break;
            }
        });
    };

    DChat.prototype.send = function (e) {
        var value = this.textbox.value.trim(), self = this;
        e.preventDefault();
        if (value !== '') {
            if (this.msgRequreToken) {
                this.port.postMessage({
                    cmd: 'send',
                    content: self.msgRequreToken.content,
                    people: self.msgRequreToken.people,
                    captcha: {
                        token: self.msgRequreToken.captcha.token,
                        string: value
                    }
                });
                this.messageList.removeChild(this.msgRequreToken.captcha.dom);
                this.msgRequreToken = null;
            }
            else {
                this.addContent('<img src="' + this.me.icon + '"><p>' + value + '</p>', 'right');
                this.port.postMessage({cmd: 'send', content: value, people: self.current});
            }

            this.textbox.value = '';
        }
    };

    DChat.prototype.receive = function (msg) {
        if (this.current === msg.people) {
            this.addContent('<img src="' + msg.icon + '"><p>' + msg.content + '</p>', 'left');
            //self.lock(false);
        }
        else if (msg.people in this.friends) {
            if (this.friends[msg.people].unread.length === 0) {
                this.friends[msg.people].unread.push(msg);
                var indicator = document.createElement('span');
                indicator.appendChild(document.createTextNode(1));
                document.querySelector('#' + msg.people + ' h2').appendChild(indicator);
            }
            else {
                this.friends[msg.people].unread.push(msg);
                document.querySelector('#' + msg.people + ' h2 span').appendChild(document.createTextNode(this.friends[msg.people].unread.length));
            }
        }
        else {
            this.friends[msg.people] = {
                name: msg.name,
                icon: msg.icon,
                sign: '',
                unread: [msg]
            };

            var div = document.createElement('div');
            div.className = 'entry';
            div.id = msg.people;
            div.innerHTML = '<div><h2>' + msg.name + '<span>1</span></h2><p></p></div><img src="' + msg.icon + '" />';
            this.friendsList.appendChild(div);
            msg.unread = [];
            this.friends[msg.people] = msg;
        }
    };

    DChat.prototype.addContent = function (html, className) {
        var div = document.createElement('div'), scrollHeight = this.messageList.scrollHeight;
        div.className = className;
        div.innerHTML = html;
        this.messageList.appendChild(div);
        if (div.getElementsByTagName('img').length > 0) {
            scrollHeight += 41;
        }
        this.messageList.scrollTop = scrollHeight;
        return div;
    };

    DChat.prototype.lock = function (status) {
        this.textbox.disabled = status;
        this.textbox.style.backgroundColor = status ? '#ddd' : '#fff';
        this.textbox.value = status ? '双击鼠标来解锁' : '';
        this.friends[this.current].isLock = status;
    };

    new DChat();

})(this, this.document);
