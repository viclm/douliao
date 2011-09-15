(function (window, undefined) {

    function DChat(args) {
        this.people = args.people;
        this.name = args.name;
        this.icon = args.icon;
        this.sign = args.sign;
        this.history = args.history;
        this.mails = args.mails;
        this.me = args.me;

        this.port = null;

        this.isLock = false;
        this.msgRequreToken = null;

        this.ad = '对方正在使用豆聊发送信息，试一试: http://is.gd/SEkK6M';
    }

    DChat.prototype.proxy = function (fn, obj) {
        return function () {
            return fn.apply(obj, arguments);
        }
    };

    DChat.prototype.start = function () {
        var self = this;

        this.port = chrome.extension.connect({name: 'dchat'});
        this.port.postMessage({cmd: 'receivestart', people: self.people, name: self.name, history: self.history, mails: self.mails});
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
                if (self.people === msg.people) {
                    self.addContent('<img src="' + self.icon + '"><p>' + msg.content + '</p>', 'left');
                    self.lock(false);
                }
                break;
            }
        });
    };

    DChat.prototype.stop = function (e) {
        var self = this, list, history = [], i;
        if (e && e.target.className === '+') {
            list = this.msgList.getElementsByTagName('div');
            for (i = 0 ; i < list.length ; i += 1) {
                history[i] = {};
                history[i].content = list[i].childNodes[1].nodeValue.slice(2);
                if (list[i].className === 'left') {
                    history[i].people = 'ta';
                }
                else {
                    history[i].people = 'me';
                }
            }
            this.port.postMessage({cmd: 'pop', people: self.people, name: self.name, icon: document.querySelector('#db-usr-profile img').src, sign: document.querySelector('h1 span') ? document.querySelector('h1 span').innerHTML.replace(/^\(|\)$/g, '') : '', history: history});
        }
        document.body.removeChild(this.chatWindow);
        this.port.disconnect();
        this.port = null;
    };

    DChat.prototype.send = function (e) {
        var value = e.target.value.trim(), self = this;
        if (e.keyCode === 13 && !e.shiftKey && !this.isLock && value !== '') {
            if (this.msgRequreToken) {
                var self = this;
                this.port.postMessage({
                    cmd: 'send',
                    content: self.msgRequreToken.content,
                    people: self.msgRequreToken.people,
                    captcha: {
                        token: self.msgRequreToken.captcha.token,
                        string: value
                    }
                });
                this.msgList.removeChild(this.msgRequreToken.captcha.dom);
                this.msgRequreToken = null;
            }
            else {
                this.addContent('<img src="' + this.me.icon + '"><p>' + value + '</p>', 'right');
                this.port.postMessage({cmd: 'send', content: value, people: self.people});
            }

            e.target.value = '';
            this.lock(true);
            e.preventDefault();
            return false;
        }
    };

    DChat.prototype.addContent = function (html, className) {
        var div = document.createElement('div'), scrollHeight = this.msgList.scrollHeight;
		div.className = className;
        div.innerHTML = html;
        this.msgList.appendChild(div);
        if (div.getElementsByTagName('img').length > 0) {
            scrollHeight += 41;
        }
        this.msgList.scrollTop = scrollHeight;
        return div;
    };

    DChat.prototype.lock = function (status) {
        this.textbox.disabled = status;
        this.textbox.style.backgroundColor = status ? '#ddd' : '#fff';
        this.textbox.value = status ? '鼠标双击解锁输入框，考虑到对方可能没有安装豆聊，请尽量不要连续发送信息给对方造成不便' : '';
        this.isLock = status;
    };

    window.DChat = DChat;

})(this);
