"use strict";
const Program = require('commander');
const fs = require('fs');
const Promise = require('bluebird');
const forAllAsync = require('forallasync').forAllAsync;

const appium = require('../lib/appium');
const util = require('../util');

var devicesList = [];

Program.version('0.3.1');

Program
    .option('-t, --stf-auth-token <token>', 'Bearer auth token from STF settings', String)
    .option('-a, --stf-address <url>', 'Url/Address of STF server, if STF is running on a different port than 80, please provide url like this: http://stf.example.org:1337', String)
    .option('-f, --testfile <path>', 'Path to the test file (.jar)', String)
    .option('-c, --config <path>', 'Path to config file', String)
    .option('-o, --output <path>', 'Where to put log files and test results', String)
    .option('-d, --devices-list <list>', 'A comma separated list of device IDs, like: -d FOO2342BAR,1337H4XX0R,HX2JEKN (optional, if a devices list exists in the config file)', String)
    .option('-p, --apk-file <path>', 'Path to the .apk file of the test object app (optional)', String)
    .option('--accept-selfsigned', 'Accept self signed ssl certificate on STF server (optional)')
    .parse(process.argv);

// check for missing arguments in CLI
if(!Program.stfAuthToken){
    console.log("Please provide auth token.");
    process.exit(1)
}else{
    Program.stfAuthToken = Program.stfAuthToken.trim();
}
if(!Program.stfAddress){
    console.log("Please provide STF address.");
    process.exit(1)
}
if(!Program.testfile){
    console.log("Please provide path to testfile.");
    process.exit(1)
}
if(!Program.config){
    console.log("Please provice config file.");
}else{
    global.configPath = Program.config;
}
if(!Program.devicesList){
    console.log("No devices list given. Using devices list in config file.");
}else{
    devicesList = Program.devicesList.split(",");
}
if(!Program.apkFile){
    Program.apkFile = "";
}

// now we can import STF module with configs given via CLI
const stf = require('../lib/stf.js')(Program);

/*
*   Starts the session. Iterates the devices list and calls the utility functions to get free ports for the
*   Appium REST service and the Appium bootstrap process.
*   (These are needed for multiple parallel Appium servers on one machine)
*
* */
function startSession() {
    util.getConfig().then((config) => {

        if(devicesList.length === 0) {
            devicesList = config.devicesList;
        }

        let portQuantity = devicesList.length;

        stf.getUserInfo().then((user) => {
            return util.createSessionDir(config.outputPath, user.name);
        }).then((sessionDir) => {
            console.log("Directory for this session: " + sessionDir);

            util.getPortList(portQuantity, config.appiumPorts.rest.min, config.appiumPorts.rest.max).then((appiumPortList) => {       // Ports for Appium Servers REST Interface
                util.getPortList(portQuantity, config.appiumPorts.bootstrap.min, config.appiumPorts.bootstrap.max).then((btPortList) => {       // Ports for Appium Bootstrap

                    let sessionData = getArrayWithRunInformationObjects(devicesList, appiumPortList, btPortList, sessionDir);
                    forAllAsync (sessionData, checkDeviceAvailabilityAndCallDeviceRoutine, 1).then(() => {
                        console.log("Iterating Devices List done.");
                        createListeners()
                    })
                })
            })
        })
    })
}

/*
*   Checks, if the current device is available. If not, it is omitted.
*   If available, it calls the real device routine
* */
function checkDeviceAvailabilityAndCallDeviceRoutine(complete, currentData) {

    stf.checkIfDeviceIsAvailable(currentData.serial).then(() => {

        deviceRoutine(complete, currentData);

    }).catch(DevNotAvailError => {

        console.log("Omitting device " + DevNotAvailError.message);
        complete();
        return err;
    })
}
/*
*  Creates an array of objects, which contain information about a test run for one phone
*
*  @param {array} devicesList The list containing the device serials of the devices to run tests on.
*  @param {array} portList Contains the Appium ports.
*  @param {array} btPortList Contains the Appium bootstrap ports.
*  @param {String} sessionDir The directory path for the current session.
* */
function getArrayWithRunInformationObjects(devicesList, portList, btPortList, sessionDir) {
    let array = [];
    devicesList.forEach( (currentValue, i) => {
        let currentObject = {
            serial: currentValue,
            port: portList[i],
            btPort: btPortList[i],
            sessionDir: sessionDir
        };
        array.push(currentObject);
    });
    return array;
}

/*
* Executes the main device routine:
*  - parse config from config file
*  - create path for current device
*  - get STFs remoteConnectUrl for current device
*  - connect device via ADB
*  - perform check, if ADB connection was successful
*  - start appium server
*  - gather information about the device from STF for the test
*  - call test file (with appium client) and hand over device information
*  - add appium server- and child pair to an array, which contains all the servers and clients
*
*  @param {function} complete The complete function of forAllAsync.
*  @param {Object} currentData The current object in the array from the getArrayWithRunInformationObjects function.
*/
var deviceRoutine = Promise.coroutine(function* (complete, currentData) {

    let config = yield util.getConfig(Program.config);

    let devicePath = yield util.createDeviceDirectoryStructure(currentData.sessionDir, currentData.serial);

    console.log("Directory structure for Device " + currentData.serial + " created.");

    let remoteConnectUrl = yield stf.getRemoteConnectUrl(currentData.serial);

    let deviceConnected = yield util.connectAdbDevice(remoteConnectUrl);

    if(deviceConnected){
        console.log("ADB connection with device " + currentData.serial + " established.");
    }

    let server = yield appium.startAppiumServer(currentData.port, currentData.btPort, devicePath);

    if (!server) {
        throw "Appium Server with port " + currentData.port + " could not be started."
    } else {
        console.log("Appium Server for device " + currentData.serial + " started. (Port: " + currentData.port + ")");
    }

    let deviceInfo = yield stf.getDeviceInfo(currentData.serial);

    let clientData = {
        pathToJarFile: Program.testfile,
        remoteConnectUrl: deviceInfo.remoteConnectUrl,
        mobileOS: deviceInfo.platform,
        version: deviceInfo.version,
        appiumAddress: config.appiumAddress,
        appiumPort: currentData.port,
        devicePath: devicePath,
        pathToApkFile: '',
        serial: currentData.serial
    };

    let client = yield appium.startAppiumClient(clientData);

    let childPair = {
        server: server,
        client: client,
        serial: deviceInfo.serial,
        devicePath: devicePath
    };

    util.addChildPair(childPair);

    complete();
});

/*
*   Iterates the child container and creates exit and error listeners for all processes.
* */
 function createListeners() {
    let container = util.getChildrenContainer();
    if(container.length === 0){
        return
    }

    container.forEach((current) => {

        //servers
        current.server.on('error', (err) => {
            console.log("Error: Appium Server: " + err)
        });

        current.server.on('exit', () => {
            console.log("Appium Server with PID " + current.server.pid + " exited.")
        });

        //clients
        current.client.on('error', (err) => {
            console.log("Error: Appium Client (TestNG): " + err);
            stf.removeDeviceBySerial(current.serial);
            util.killAndRemoveChildPair(current.client.pid)
        });

        current.client.on('exit', () => {
            console.log("Appium Client (TestNG) with PID " + current.client.pid + " exited.")
            console.log("----> Test finished. Folder: " + current.devicePath);
            stf.removeDeviceBySerial(current.serial);
            util.killAndRemoveChildPair(current.client.pid)
        });

        // detect and report if this child was killed
        current.client.on("SIGTERM", () => {
            console.log("Appium Client (TestNG) with PID " + current.client.pid + " exited.")
            client.exit()
        });
    })
}

// Listeners for main process
process.on('exit', function () {
    if(util.getChildrenContainer().length > 0) {
      util.killAllChildren()
    }
    stf.removeAllDevices();
    console.log("Exiting.")
});

process.on('error', function (err) {
    util.killAllChildren();
    stf.removeAllDevices();
    console.log("Exiting because of error: " + err)
});

// starts the session
startSession();