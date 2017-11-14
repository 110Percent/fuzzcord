const { app, BrowserWindow, ipcMain } = require('electron'),
    path = require('path'),
    url = require('url'),
    open = require('open'),
    CircularJSON = require('circular-json-es6'),
    stringify = require('json-stringify'),
    uConfig = require('./config/userConfig'),
    discordjs = require('discord.js'),
    dClient = new discordjs.Client();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win, contents, currentChannel;
currentChannel = null;

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({ width: 1600, height: 900 });
    contents = win.webContents;
    // and load the index.html of the app.
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'client/index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

dClient.login(uConfig.discordToken);
let sendClient, gChannels;

dClient.on('ready', () => {
    let parseClient = {
        user: dClient.user
    };
    sendClient = stringify(parseClient);
    contents.send('logged-in', sendClient);
    console.log('Logged in');
});

ipcMain.on('check-login', (event) => {
    if (dClient.readyAt != null) {
        currentChannel = null;
        event.sender.send('logged-in', sendClient);
    }
});

ipcMain.on('get-guilds', (event) => {
    let sGuilds = stringify(dClient.guilds.array());
    event.sender.send('rec-guilds', sGuilds);
});

ipcMain.on('get-channels', (event, id) => {
    gChannels = dClient.guilds.array().filter((o) => { return o.id == id })[0].channels.array().filter((o) => { return o.type == 'text' });
    let sChannels = stringify(gChannels);
    event.sender.send('rec-channels', sChannels);
});

ipcMain.on('set-channel', (event, id) => {
    currentChannel = dClient.channels.array().filter((o) => { return o.id == id })[0];
    currentChannel.fetchMessages({ limit: 50 })
        .then(messages => {
            let sortedMsgs = messages.sort(function(a, b) {
                    return (a.createdTimestamp < b.createdTimestamp) ? -1 : (a.createdTimestamp > b.createdTimestamp) ? 1 : 0;
                }),
                sMessages = stringify(sortedMsgs.array()),
                sMembers = stringify(sortedMsgs.map(c => c.member)),
                sAuthors = stringify(sortedMsgs.map(c => c.author.avatarURL));
            event.sender.send('rec-messageback', sMessages, sMembers, sAuthors);
        })
});

ipcMain.on('send-message', (event, msgContent) => {
    currentChannel.send(msgContent);
});

dClient.on('message', (msg) => {
    if (currentChannel == null) return;
    if (msg.channel.id == currentChannel.id) {
        let sMessage = stringify(msg),
            sMember = stringify(msg.member),
            sAvatar = stringify(msg.author.avatarURL);
        contents.send('new-message', sMessage, sMember, sAvatar);
    }
});