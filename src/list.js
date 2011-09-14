var header = document.querySelector('header'), entryList = document.querySelector('section'), contextmenu;

function openPanel(e) {
    if (e.detail > 1) {
        var response = {cmd: 'createWindow'};
        response.people = this.id;
        response.name = this.querySelector('h2').innerHTML;
        response.sign = this.querySelector('p').innerHTML;
        response.icon = this.querySelector('img').src;
        response.updateFriend = true;
        response.history = [];
        chrome.extension.sendRequest(response);
        e.preventDefault();
        return false;
    }
}

function openContextmenu(e) {
    contextmenu.rel = this;
    contextmenu.style.left = e.pageX + 'px';
    contextmenu.style.top = e.pageY + 'px';
    contextmenu.style.display = '';
    e.stopPropagation();
}

chrome.extension.sendRequest({cmd: 'getList'}, function(response) {
    var me = response.me, friends = response.friends, key, div;
    //header.querySelector('h1').appendChild(document.createTextNode(me.name));
    //header.querySelector('p').appendChild(document.createTextNode(me.sign));
    //header.querySelector('img').src = me.icon;

    contextmenu = document.createElement('div');
    contextmenu.innerHTML = '删除好友';
    contextmenu.className = 'contextmenu';
    contextmenu.style.display = 'none';
    contextmenu.addEventListener('click', function (e) {
        var people = this.rel.id;
        chrome.extension.sendRequest({cmd: 'deleteFriend', people: people});
        entryList.removeChild(this.rel);
        this.rel = undefined;
    }, false);
    document.body.appendChild(contextmenu);
    document.body.addEventListener('click', function (e) {
        contextmenu.style.display = 'none';
    }, false);


    for (key in friends) {
        div = document.createElement('div');
        div.className = 'entry';
        div.id = key;
        div.innerHTML = '<div><h2>' + friends[key].name + '</h2><p> ' + friends[key].sign + ' </p></div><img src="' + friends[key].icon + '" />';
        div.addEventListener('click', openPanel, false);
        div.addEventListener('contextmenu', openContextmenu, false);
        entryList.appendChild(div);
    }
});
