"use strict";
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const fsExtra = Promise.promisifyAll(require('fs-extra'));
const portastic = require('portastic');
const execFile = require('child_process').execFile;

const util = module.exports = Object.create(null);

// Array to save all the chuld processes.
var childContainer = [];

/*
*   Parses the config file and returns an object containing the config.
*
*   @raturn {Object} The object containing the config.
* */
util.getConfig = function() {
    let configPath = global.configPath;
    return fsExtra.readJSONAsync(configPath)
        .then((config) => {
            config.appiumPath = config.appiumPath || "appium";
            config.javaPath = config.appiumPath || "java";
            return config
    })
};

/*
*   Creates a directory for the output of the current session.
*   The folder is created by username in STF, a modified ISO time string and uses fs.mkdtempAsync()
*   to add a random String to the end, if multiple test runs are started at the same timestamp.
*   (To provide a unique folder name)
*
*   @param {String} path The output path given in the config file.
*   @param {String} userName The username of the current user in STF.
* */
util.createSessionDir = function(path, userName) {
    let basePath = path;
    let date = new Date().toISOString();
    date = date.replace(new RegExp(/[:.]/, 'g'), "-");
    let runPath = basePath + '/' + userName + '_session_' + date;

    fsExtra.ensureDirSync(basePath);
    return fs.mkdtempAsync(runPath + "-")
        .then((sessionDir) => {
            return sessionDir
    })
};

/*
*   Creates a directory for a device.
*
*   @param {String} sessionFolder The folder from util.createSessionDir.
*   @param {String} serial The serial number of the device.
*
*   @return {String} The path for the device.
* */
util.createDeviceDirectoryStructure = function(sessionFolder, serial) {
    let devicePath = sessionFolder + "/" + serial;
    return fs.mkdirAsync(devicePath)
        .then((err) => {
            if (err) {
                console.log(err);
                return
            }
            fs.mkdirAsync(devicePath + "/log").then((err) => { if (err) console.log(err) });

            return devicePath
        })
};

/*
*   Uses portastic to find free ports in a port range.
*   Seems to work only reliable on Linux.
*
*   @param {number} numberOfFreePorts The needed quantity of free ports.
*   @param {number} minPort The minimum port number.
*   @param {number} maxPort The maximum port number.
*
*   @return {array} An array containing the list of free ports.
* */
util.getPortList = function(numberOfFreePorts, minPort, maxPort) {
    if(minPort > maxPort || maxPort - minPort < numberOfFreePorts){     // check for correct port range because of known bugs in portastic
        throw { name: "PortRangeError", message: "Wrong port range"}
    }
    return portastic.find({
        min: minPort,
        max: maxPort,
        retrieve: numberOfFreePorts
    }).then((ports) => {
        return ports;
    })
};

/*
*   Executes the "adb connect" command.
*
*   @param {String} remoteConnectUrl The remoteConnectUrl from STF.
*
*   @return {boolean} Returns true, is command was successful.
* */
util.connectAdbDevice = function(remoteConnectUrl) {
    return new Promise ((resolve, reject) => {
        let command = 'adb';

        execFile(command, ['connect', remoteConnectUrl], (error, stdout, stderr) => {
            if (error) {
                reject(false);
                throw error;
            }
            // check output of child for connected device
            var lines = stdout.toString().split('\n');
            lines.forEach(function(line) {
                line = line.trim();
                let outputString = "connected to " + remoteConnectUrl;
                if(line == outputString){
                    resolve(true);
                }
            });
        })
    })
};

/*
*   Executes the "adb disconnect" command.
*
*   @param {String} remoteConnectUrl The remoteConnectUrl from STF.
*
*   @return {boolean} Returns true, is command was successful.
* */
util.disconnectAdbDevice = function(remoteConnectUrl) {
    return new Promise ((resolve, reject) => {
        let command = 'adb';

        execFile(command, ['disconnect', remoteConnectUrl], (error, stdout, stderr) => {
            if (error) {
                reject(false);
                throw error;
            }
            resolve(true);
        })

    })
};

///// Handle child processes

/*
*   Adds a child pair object to the container array
*
*   @param {Object} childPair The object containing the child pair of Appium server and client from CLI's deviceRoutine function
* */
util.addChildPair = function(childPair) {
    childContainer.push(childPair);
};

/*
*   Iterates the child container array and kills all child processes.
* */
util.killAllChildren = function() {
    console.log("Killing all child processes...");

    childContainer.forEach((current) => {
        current.client.kill();
        current.server.kill();
    })
};

/*
*   Kills a specific child pair identified by the PID of the Appium client process and removes it from the container.
*
*   @param {number} pid The PID of the corresponding Appium client of the desired child pair.
* */
util.killAndRemoveChildPair = function(pid) {
    childContainer = childContainer.filter( (current) => {
        if(current.client.pid === pid) {
            current.client.kill();
            current.server.kill();
        }
        return current.client.pid !== pid;
    })
};

/*
*   Returns the child container array.
*
*   @return {array} The array containing the child processes.
* */
util.getChildrenContainer = function () {
    return childContainer;
};
