(function (window, undefined) {

    function DChat(args) {
        this.people = {};
        this.history = args.history;
        this.mails = args.mails;
        this.me = args.me;

        this.chatWindow = this.createUI();

        this.isLock = false;
        this.msgRequreToken = null;

        this.ad = '对方正在使用豆聊发送信息，试一试: http://is.gd/SEkK6M';

        var self = this;

        this.port = chrome.extension.connect({name: 'dchat'});
        this.port.postMessage({cmd: 'receivestart', people: self.people, name: self.name, history: self.history, mails: self.mails});
        this.port.onMessage.addListener(function (msg) {
            switch (msg.cmd) {
            case 'sendError':
                var captcha = self.addContent('发送太快了亲，输入验证码<img src="' + msg.content.captcha.string + '">', 'captcha');
                self.people[msg.content.uid].captcha = msg.content;
                break;
            case 'received':
                if (self.people === msg.people) {
                    self.addContent('<img src="' + self.icon + '"><p>' + msg.content + '</p>', 'left');
                    self.lock(false);
                }
                break;
            case 'setStatus':
                if (!msg.status) {
					self.chatWindow.querySelector('header').style.display = '';
				}
                break;
            }
        });
    }

    DChat.prototype.proxy = function (fn, obj) {
        return function () {
            return fn.apply(obj, arguments);
        }
    };

    DChat.prototype.add = function (person) {
        person.ui = this.createUI();
        this.people[person.uid] = person;
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
        var value = e.target.value.trim(), uid = e.target.dataSet.uid, self = this;
        if (e.keyCode === 13 && !e.ctrlKey && value !== '') {
            if (this.people[uid].captcha) {
                this.port.postMessage({
                    cmd: 'send',
                    content: self.people[uid].captcha.content,
                    uid: uid,
                    captcha: {
                        token: self.people[uid].captcha.captcha.token,
                        string: value
                    }
                });
                e.target.parentNode.previousSibling.removeChild(e.target.parentNode.previousSibling.lastChild);
                delete this.people[uid].captcha;
            }
            else {
                this.addContent(value + '<time>' + this.strftime(new Date()) + '</time>', 'me');
                this.port.postMessage({cmd: 'send', content: value, uid: uid});
            }

            e.target.value = '';
            e.preventDefault();
        }
    };

    DChat.prototype.addContent = function (html, className) {
        var div = document.createElement('p'), scrollHeight = this.msgList.scrollHeight;
		div.className = className;
        div.innerHTML = html;
        this.msgList.appendChild(div);
        if (div.getElementsByTagName('img').length > 0) {
            scrollHeight += 41;
        }
        this.msgList.scrollTop = scrollHeight;
        return div;
    };

    DChat.prototype.strftime = function (time) {
        var time = new Date(time), str;
        str = time.getMonth() + 1 + '月' + time.getDate() + '日 ';
        str += (time.getHours() > 9 ? time.getHours() : '0' + time.getHours()) + ' : ' + (time.getMinutes() > 9 ? time.getMinutes() : '0' + time.getMinutes());
        return str;
    };

    DChat.prototype.createUI = function (person) {
        var aside = document.createElement('div'), html;
        html = '<header><h1>'+person.name+'</h1><div></div></header><section><div class="message"></div><div class="textbox"><textarea></textarea></div></section>';
        aside.innerHTML = html;
        document.body.appendChild(aside);
        aside.querySelector('header').addEventListener('click', function (e) {
            if (this.nextSibling.style.display === 'none') {
                this.nextSibling.style.display = 'block';
            }
            else {
                this.nextSibling.style.display = 'none'
            }
        }, false);
        aside.querySelector('header div').appendChild(this.drawPop());
        aside.querySelector('header div').appendChild(this.drawClose());
        aside.querySelector('textarea').addEventListener('keyup', this.proxy(this.send, this), false);
        aside.querySelector('textarea').dataSet.uid = person.uid;
        var tray = document.getElementById('dchat');
        if (!tray) {
            tray = document.createElement('aside');
            tray.id = 'dchat';
            document.body.appendChild(tray);
        }
        tray.appendChild(aside);
        return aside;
    };

    DChat.prototype.drawPop = function () {
        var canvas = document.createElement('canvas'), ctx;
        canvas.width = 100;
        canvas.height = 100;
        ctx = canvas.getContext('2d');
        ctx.strokeStyle = 'white';
        ctx.fillStyle = 'white';
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
        return canvas;
    };

    DChat.prototype.drawClose = function () {
        var canvas = document.createElement('canvas'), ctx;
        canvas.width = 100;
        canvas.height = 100;
        ctx = canvas.getContext('2d');
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'white';
        ctx.beginPath();
        ctx.moveTo(5,5);
        ctx.lineTo(95, 95);
        ctx.moveTo(95, 5);
        ctx.lineTo(5, 95);
        ctx.stroke();
        return canvas;
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

    if (location.href.indexOf('http') === 0) {
        var container = document.querySelector('#profile .user-opt'), button, dchat;

        dchat = new DChat();

        if (container === null) {return;}

        button = container.querySelector('a.mr5').cloneNode(false);
        button.innerHTML = '聊天';
        button.style.marginLeft = '5px';
        container.insertBefore(button, document.getElementById('divac'));
        button.addEventListener('click', function (e) {
            var people = {
                uid: location.href.match(/\/([^\/]+)\/?$/)[1],
                name: document.title.trim(),
                icon: document.querySelector('#db-usr-profile img').src,
                sign: document.querySelector('h1 span') ? document.querySelector('h1 span').innerHTML.replace(/^\(|\)$/g, '') : ''
            };
            chrome.extension.sendRequest({
                cmd: 'chatStart',
                content: people
            }, function (response) {
                if (response.cmd === 'chatInit') {
                    dchat.add(people);
                }
            });
            e.preventDefault();
        }, false);

    }

})(this);
