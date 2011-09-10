chrome.extension.sendRequest({cmd: 'getPeopleInfo', people: location.href.match(/#([^#]+)$/)[1]}, function(response) {
    document.title = response.name;
    var dchat = new DChat(response), msgList, div, i;
    dchat.start();
    msgList = dchat.chatWindow.querySelector('section>div');
    for (i = 0 ; i < response.history.length ; i += 1) {
        div = document.createElement('div');
        if (response.history[i].people === 'me') {
            div.innerHTML = '<img src="' + response.me.icon + '"><p>' + response.history[i].content + '</p>';
            div.className = 'right';
        }
        else {
            div.innerHTML = '<img src="' + response.icon + '"><p>' + response.history[i].content + '</p>';
            div.className = 'left';
        }
        msgList.appendChild(div);
    }
    msgList.parentNode.style.height = (window.innerHeight - 29) * 0.96 + 'px';
    window.onresize = function () {
        msgList.parentNode.style.height = (window.innerHeight - 29) * 0.96 + 'px';
    }
});
