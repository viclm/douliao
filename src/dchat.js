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
            }

            self.me = response.me;
            self.friends = friends;
            self.start();
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
        var target = e.target;
        if (this.current !== target.id) {
            this.messageList.innerHTML = target.rel || '';
            if (this.current) {
                document.getElementById(this.current).className = 'entry';
            }
            else {
                this.content.style.left = '30%';
            }
            target.className = 'entry active';
            this.current = target.id;
        }
    };

    DChat.prototype.close = function () {
        var entry = document.getElementById(this.current);
        entry.className = 'entry';
        entry.rel = this.messageList.innerHTML;
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
                if (self.current === msg.people) {
                    self.addContent('<img src="' + msg.icon + '"><p>' + msg.content + '</p>', 'left');
                    self.lock(false);
                }
                else if (msg.people in self.friends) {
                    if (self.friends[msg.people].unread === undefined) {
                        self.friends[msg.people].unread = [msg];
                    }
                    else {
                        self.friends[msg.people].unread.push(msg);
                    }
                }
                else {
                    self.friends[msg.people] = {
                        name: msg.name,
                        icon: msg.icon,
                        sign: '',
                        unread: [msg]
                    };

                    var div = document.createElement('div');
                    div.className = 'entry';
                    div.id = msg.people;
                    div.innerHTML = '<div><h2>' + msg.name + '</h2><p></p></div><img src="' + msg.icon + '" />';
                    self.friendsList.appendChild(div);
                }
                break;
            }
        });
    };

    DChat.prototype.send = function (e) {
        var value = this.messageList.value.trim(), self = this;
        if (!this.isLock && value !== '') {
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

            e.target.value = '';
            this.lock(true);
        }
        e.preventDefault();
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
        this.isLock = status;
    };

    new DChat();

})(this, this.document);
