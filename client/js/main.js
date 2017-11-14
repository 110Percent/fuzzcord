// In renderer process (web page).
const { ipcRenderer, shell } = require('electron'),
    circularJSON = require('circular-json-es6'),
    showdown = require('showdown'),
    converter = new showdown.Converter({
        strikethrough: true,
        emoji: true,
        simpleLineBreaks: true
    }),
    isURL = require('is-url');
window.$ = window.jQuery = require('jquery');
let client, guilds, gChannels, input;
let imageTypeRegex = /^(webp|jpg|png|gif|jpeg|bmp)$/g

//open links externally by default
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    shell.openExternal(this.href);
});

ipcRenderer.send('check-login');
ipcRenderer.on('logged-in', (event, sClient) => {
    ipcRenderer.send('get-guilds');
    client = circularJSON.parse(sClient);
    console.log('Logged in');
    $('.dropdown-button').text(`${client.user.username}#${client.user.discriminator}`);

    $('.side-nav').html()
    $('.overlay').hide();
});

ipcRenderer.on('rec-guilds', (event, sGuilds) => {
    guilds = circularJSON.parse(sGuilds);
    $.get('templates/guildScrollerItem.html', (gsItem) => {

        /*if (client.user.bot == true) { */
        guilds.sort(function(a, b) {
            var textA = a.name.toUpperCase();
            var textB = b.name.toUpperCase();
            return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
        });
        /* } else {
            guilds.sort(function(a, b) {
                return (a.position < b.position) ? -1 : (a.position > b.position) ? 1 : 0;
            });
        } */
        let guildItems = [];
        for (var gI in guilds) {
            guildItems.push(gsItem.replace('%GUILDID%', guilds[gI].id).replace('%GUILDNAME%', guilds[gI].name));
        }
        $('.guild-nav').html(guildItems.join('\n'));
    });
});

ipcRenderer.on('rec-channels', (event, sChannels) => {
    gChannels = circularJSON.parse(sChannels);
    console.log(gChannels[0].name);
    $.get('templates/channelScrollerItem.html', (csItem) => {

        /*if (client.user.bot == true) { */
        gChannels.sort(function(a, b) {
            return (a.position < b.position) ? -1 : (a.position > b.position) ? 1 : 0;
        });
        /* } else {
            guilds.sort(function(a, b) {
                return (a.position < b.position) ? -1 : (a.position > b.position) ? 1 : 0;
            });
        } */
        let channelItems = [];
        for (var cI in gChannels) {
            channelItems.push(csItem.replace('%CHANNELID%', gChannels[cI].id).replace('%CHANNELNAME%', `#${gChannels[cI].name}`));
        }
        $('.channel-nav').html(channelItems.join('\n'));
    });
});

function setChannel(id) {
    ipcRenderer.send('set-channel', id);
    $('.channel-name').text(`#${gChannels.filter(o => { return o.id == id })[0].name}`);
}

ipcRenderer.on('rec-messageback', (event, sMessages, sMembers, sAuthors) => {
    let backMsgs = circularJSON.parse(sMessages),
        backMembers = circularJSON.parse(sMembers),
        backAuthors = circularJSON.parse(sAuthors);
    $.get('templates/messageTemplate.html', (msgElement) => {
        console.log(backAuthors[0]);
        let msgItems = [];
        for (var mI in backMsgs) {
            msgItems.push(editContent(msgElement, backMembers[mI], backMsgs[mI], backAuthors[mI]));
        }
        $('.message-scroller').html(msgItems.join('\n'));
        $('.chat-topbar').show();
    });
});

ipcRenderer.on('new-message', (event, sMessage, sMember, sAvatar) => {
    let msg = circularJSON.parse(sMessage),
        member = circularJSON.parse(sMember),
        avatar = circularJSON.parse(sAvatar);
    $.get('templates/messageTemplate.html', (msgElement) => {
        $('.message-scroller').append(editContent(msgElement, member, msg, avatar));
    })
    $('#message-scroller-container').stop().animate({
        scrollTop: $('#message-scroller-container')[0].scrollHeight - 100
    }, 800);
});

$('ready', () => {
    $(".button-collapse").sideNav();
    input = $('#input');

    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) {
                return;
            }
            ipcRenderer.send('send-message', msg);
            $(this).val('');
        }
    });
});

function editContent(msgElement, member, msg, avatar) {
    let newElement;

    // Insert user displayname
    newElement = msgElement.replace('%AUTHORNAME%', member.nickname ? member.nickname : member.user.username).replace('%NAMECOLOUR%', member.displayHexColor);

    // Insert message content
    let msgSplit = msg.content.split(' ');
    for (let i = 0; i < msgSplit.length; i++) {
        let potURL = msgSplit[i];
        if (isURL(potURL)) {
            msg.content = msg.content.replace(potURL, `<a href="${potURL}">${potURL}</a>`);
            console.log(potURL.split('.')[potURL.split('.').length - 1].match(imageTypeRegex));
            if (potURL.split('.')[potURL.split('.').length - 1].match(imageTypeRegex) != null) {
                msg.content = msg.content + `\n<br>\n<img class="image-embed" src="${potURL}"></img>`;
            }
        }
    }
    msg.content = twemoji.parse(converter.makeHtml(msg.content));
    newElement = newElement.replace('%MSGCONTENT%', msg.content);

    // Insert avatar image
    newElement = newElement.replace('%AVATARURL%', avatar == null ? 'https://discordapp.com/assets/dd4dbc0016779df1378e7812eabaa04d.png' : avatar);

    let emoteRegex = /<:[A-Za-z\d]+:\d+>/g;
    let emoteFound;
    while ((emoteFound = emoteRegex.exec(newElement)) != null) {
        let emoteID = emoteFound[0].split(':')[2].replace('>', '');
        let emojiClass = 'emoji';
        if (msg.content == emoteFound[0]) {
            emojiClass = 'emoji-large';
        }
        newElement = newElement.replace(emoteFound, `<img class="${emojiClass}" src="https://cdn.discordapp.com/emojis/${emoteID}.png"></img>`);
    }

    return newElement;
}