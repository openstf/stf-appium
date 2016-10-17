"use strict";
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const spawn = require('child_process').spawn;
const OS = require('os');

const util = require('../util');

const appium = module.exports = Object.create(null);

/*
*   Start appium server with given ports and create log files in the folder for corresponding device.
*
*   @param {number} appiumPort The port for the Appium server.
*   @param {number} bootstrapPort The port for the Appium bootstrap process.
*   @param {number} devicePath The path to the device directory.
*/
appium.startAppiumServer = function(appiumPort, bootstrapPort, devicePath) {
    return new Promise( (resolve, reject) => {
        return util.getConfig().then( (config) => {

            const stdOut = fs.openSync(devicePath + '/log/appiumOut.log', 'a');
            const stdErr = fs.openSync(devicePath + '/log/appiumErr.log', 'a');

            let os = OS.platform();
            let server;

            if(os === ("linux" || "darwin" )) {

                server = spawn(config.appiumPath,
                    ["--local-timezone", "--address", config.appiumAddress, "--port", appiumPort, "--bootstrap-port", bootstrapPort],
                    {detached: false, env: {"ANDROID_HOME":config.ANDROID_HOME}, stdio: [ 'ignore', stdOut, stdErr ]});

            } else if (os === "win32") {

                server = spawn("node",
                    ["C:/Program Files (x86)/Appium/node_modules/appium/bin/appium.js", "--local-timezone", "--address", config.appiumAddress, "--port", appiumPort, "--bootstrap-port", bootstrapPort],
                    {detached: false, env: {"ANDROID_HOME":config.ANDROID_HOME}, stdio: [ 'ignore', stdOut, stdErr ]});
            }

            if (server) {
                resolve(server)
            } else {
                reject("Appium Server could not be started. Port: " + appiumPort + ", PID: " + server.pid)
            }
        })
    })
};

/*
*  Starts the test file in the form of a .jar file containing test and appium client.
*
*  @param {Object} testData Contains data about the device and the test, such as:
*                               pathToJarFile
*                               remoteConnectUrl
*                               mobileOS
*                               androidVersion
*                               appiumAddress
*                               appiumPort
*                               pathToApkFile
*                               devicePath
* */
appium.startAppiumClient = function(testData) {
    return new Promise( (resolve, reject) => {
        // let command = config.javaPath + '-jar ' + pathToJarFile + ' ' + deviceID + ' ' + mobileOS + ' ' + androidVersion + ' ' + pathToApkFile + ' ' + appiumAddress + ' ' + appiumPort

        const stdOut = fs.openSync(testData.devicePath + '/log/testOut.log', 'a');
        const stdErr = fs.openSync(testData.devicePath + '/log/testErr.log', 'a');

        let client = spawn("java",
            ["-jar", testData.pathToJarFile, testData.remoteConnectUrl, testData.mobileOS, testData.androidVersion, testData.appiumAddress, testData.appiumPort, testData.pathToApkFile],
            {cwd:testData.devicePath , detached: false,  stdio: [ 'ignore', stdOut, stdErr ]});

        if (client) {
            resolve(client)
        } else {
            reject("Appium Client (TestNG) could not be started. Port: " + testData.appiumPort + ", PID: " + client.pid)
        }
    });
};