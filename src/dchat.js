(function (window, undefined) {

    function DChat(args) {
        this.people = args.people;
        this.name = args.name;
        this.icon = args.icon;
        this.sign = args.sign;
        this.history = args.history;
        this.mails = args.mails;
        this.me = args.me;

        this.chatWindow = null;
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
        this.chatWindow = this.createUI();

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
                    self.addContent(self.ui === 'simple' ? '<img src="' + self.icon + '"><p>' + msg.content + '</p>' : '<strong>' + self.name + '说</strong>: ' + msg.content, 'left');
                    self.lock(false);
                }
                break;
            case 'setStatus':
                var img = self.chatWindow.querySelector('header img');
                img.src = self.drawStatus(msg.status);
                img.className = msg.status;
                img.style.display = '';
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
        var value = e.target.value, self = this;
        if (e.keyCode === 13 && !e.shiftKey && !this.isLock && value.trim() !== '') {
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
                this.addContent(this.me ? '<img src="' + this.me.icon + '"><p>' + value + '</p>' : '<strong>我说</strong>: ' + value, 'right');
                if (this.ad) {
                    value += '\n\n' + this.ad;
                    this.ad = undefined;
                }
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

    DChat.prototype.createUI = function () {
        var aside = document.createElement('aside'), metaBtn, html = '';
        aside.id = 'dchat';
        html += '<header><img style="display: none" /><p>' + (this.sign ? this.sign : '') + '</p></header><section><div></div><div><textarea></textarea></div></section>';
        aside.innerHTML = html;
        document.body.appendChild(aside);
        aside.querySelector('header img').addEventListener('click', this.proxy(function (e) {
            if (e.target.className === 'false') {
                var self = this;
                this.port.postMessage({cmd: 'addFriend', people: self.people, name: self.name, icon: (self.icon || document.querySelector('#db-usr-profile img').src), sign: self.sign || (document.querySelector('h1 span') ? document.querySelector('h1 span').innerHTML.replace(/^\(|\)$/g, '') : '')});
                e.target.className = 'true';
                e.target.src = this.drawStatus(true);
            }
        }, this), false);
        this.msgList = aside.querySelector('section>div');
        this.textbox = aside.querySelector('textarea');
        this.textbox.addEventListener('keyup', this.proxy(this.send, this), false);
		this.textbox.parentNode.addEventListener('click', this.proxy(function (e) {console.log(e.detail)
			if (e.detail === 2) {
				this.lock(false);
				e.preventDefault();
			}
		}, this), false);
        return aside;
    };

    DChat.prototype.drawMin = function () {
        var canvas = document.createElement('canvas'), ctx;
        canvas.width = 100;
        canvas.height = 100;
        canvas.style.backgroundColor = 'rgba(0, 0, 0, 1)';
        ctx = canvas.getContext('2d');
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#0C7823';
        ctx.beginPath();
        ctx.moveTo(5,85);
        ctx.lineTo(95, 85);
        ctx.stroke();
        return canvas.toDataURL();
    };

    DChat.prototype.drawPop = function () {
        var canvas = document.createElement('canvas'), ctx;
        canvas.width = 100;
        canvas.height = 100;
        canvas.style.backgroundColor = 'rgba(0, 0, 0, 1)';
        ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#0C7823';
        ctx.fillStyle = '#0C7823';
        ctx.beginPath();
        ctx.moveTo(95, 5);
        ctx.lineTo(45, 5);
        ctx.lineTo(95, 55);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.lineWidth = 10;
        ctx.moveTo(75, 25);
        ctx.lineTo(5, 95);
        ctx.stroke();
        return canvas.toDataURL();
    };

    DChat.prototype.drawClose = function () {
        var canvas = document.createElement('canvas'), ctx;
        canvas.width = 100;
        canvas.height = 100;
        canvas.style.backgroundColor = 'rgba(0, 0, 0, 1)';
        ctx = canvas.getContext('2d');
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#0C7823';
        ctx.beginPath();
        ctx.moveTo(5,5);
        ctx.lineTo(95, 95);
        ctx.moveTo(95, 5);
        ctx.lineTo(5, 95);
        ctx.stroke();
        return canvas.toDataURL();
    };

    DChat.prototype.drawStatus = function (isFriend) {
        var canvas = document.createElement('canvas'), ctx;
        canvas.width = 100;
        canvas.height = 100;
        canvas.style.backgroundColor = 'rgba(0, 0, 0, 1)';
        ctx = canvas.getContext('2d');
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#0C7823';
        ctx.beginPath();
        if (isFriend) {
            ctx.moveTo(5, 50);
            ctx.lineTo(35, 95);
            ctx.lineTo(95, 35);
        }
        else {
            ctx.moveTo(5, 50);
            ctx.lineTo(95, 50);
            ctx.moveTo(50, 5);
            ctx.lineTo(50, 95);
        }
        ctx.stroke();
        return canvas.toDataURL();
    };

    window.DChat = DChat;

})(this);
