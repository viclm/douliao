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


