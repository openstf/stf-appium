"use strict";
const Swagger = require('swagger-client');

module.exports = function (options) {

    var stf = {};

    const STF_ADDRESS = options.stfAddress;
    const AUTH_TOKEN = options.stfAuthToken;
    const SWAGGER_URL = STF_ADDRESS + "/api/v1/swagger.json";

    let scheme = "http";

    checkSsl();

    var apiClient = new Swagger({
        url: SWAGGER_URL
        , scheme: scheme
        , usePromise: true
        , authorizations: {
            accessTokenAuth: new Swagger.ApiKeyAuthorization('Authorization', 'Bearer ' + AUTH_TOKEN, 'header')
        }
    });

    // public functions

    /*
    *   Gets the URL for ADB connection the a device.
    *
    *   @param {String} serial The serial number for the device.
    *   @return {String} The remoteConnectUrl for the device.
    * */
    stf.getRemoteConnectUrl = function (serial) {
        return apiClient.then(function (api) {
            return api.devices.getDeviceBySerial({
                serial: serial
                , fields: 'serial,present,ready,using,owner'
            }).then( (res) => {
                // check if device can be added or not
                var device = res.obj.device;
                if (!device.present || !device.ready || device.using || device.owner) {
                    console.log('Device (' + serial + ') is not available');
                    throw 'Device (' + serial + ') is not available';
                }
                // add device to user
                return api.user.addUserDevice({
                    device: {
                        serial: device.serial
                        , timeout: 900000
                    }
                }).then((res) => {
                    if (!res.obj.success) {
                        console.log('Could not add device');
                        throw res
                    }

                    // get remote connect url
                    return api.user.remoteConnectUserDeviceBySerial({
                        serial: device.serial
                    }).then((res) => {
                        return res.obj.remoteConnectUrl
                    })
                })
            })
        })
    };

    /*
    *   Throws an error if the device is not available.
    *
    *   @throws DevNotAvailError
    * */
    stf.checkIfDeviceIsAvailable = function(serial) {
        return apiClient.then(function (api) {
            return api.devices.getDeviceBySerial({
                serial: serial
                , fields: 'serial,present,ready,using,owner'
            }).then( (res) => {
                // check if device can be added or not
                var device = res.obj.device;
                if (!device.present || !device.ready || device.using || device.owner) {
                    console.log('Device (' + serial + ') is not available');
                    throw {name: "DevNotAvailError", message: serial}
                }
            })
        })
    };

    /*
    *   Removes a device from the current user.
    *
    *   @param {String} serial The serial number of the device.
    * */
    stf.removeDeviceBySerial = function (serial) {
        return apiClient.then( (api) => {
            return api.user.getUserDevices({
                serial: serial
                , fields: 'serial,present,ready,using,owner'
            }).then( (res) => {
                // check if user has that device or not
                let devices = res.obj.devices;
                let hasDevice = false;

                devices.forEach( (device) => {
                    if (device.serial === serial) {
                        hasDevice = true;
                    }
                });

                if (!hasDevice) {
                    console.log('You do not own the device with the serial ' + serial + '. Not removing.');
                    return
                }

                return api.user.deleteUserDeviceBySerial({
                    serial: serial
                }).then( (res) => {
                    if (!res.obj.success) {
                        console.log('Could not disconnect device %s', serial);
                        return
                    }
                    console.log('Device disconnected successfully! (Serial: %s)', serial)
                })
            })
        }).catch(function(err) {
            console.log(err)
        })
    };

    /*
    *   Returns an object containing information about a device.
    *
    *   @param {String} serial The serial number of a device.
    *   @return {Object} An object containing the device information.
    * */
    stf.getDeviceInfo = function(serial) {
        return apiClient.then(function(api) {
            return api.devices.getDeviceBySerial({serial: serial})
                .then(function(res) {
                    return res.obj.device
                })
        }).catch(function(err) {
            console.log(err)
        })
    };

    /*
    *   Returns name and email of the current user.
    *
    *   @return {Object} The object containing name and email.
    * */
    stf.getUserInfo = function () {
        return apiClient.then( (api) => {
            return api.user.getUser({ fields: 'name,email'})
                .then( (res) => {
                    // console.log(res.obj.user)
                    console.log("Current user: %s (%s)", res.obj.user.name, res.obj.user.email);
                    return res.obj.user
                })
        }).catch(function(err) {
            console.log(err)
        })
    };

    /*
    *   Removes all currently used devices from the user
    * */
    stf.removeAllDevices = function(){
        apiClient.then( (api) => {
            api.user.getUserDevices({
                fields: 'serial,using'
            }).then((res) => {
                let devices = res.obj.devices;
                console.log("Removing all devices from user.")
                devices.forEach( (device) => {
                    stf.removeDeviceBySerial(device.serial)
                });
            });
        });
    };

    // private functions

    /*
    *   Checks the URL of the STF server for subtring "https" and sets the scheme for the swagger client to https.
    *   Also checks for the --accept-selfsigned flag from the CLI and sets and environment variable for the
    *   Node process to work with untrusted certificates.
    *
    * */
    function checkSsl() {
        // check for SSL and whether we accept self-signed certificates and set as environment vars
        let httpsRegex = /^https:\/\//;
        let regex = new RegExp(httpsRegex);

        if (regex.test(options.stfAddress)) {
            scheme = "https";
            console.log("Running in https mode");
            // accept self signed certificates
            if (options.acceptSelfsigned) {
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
                console.log("Accepting self-signed certificates")
            } else {
                console.log("Accepting only trusted certificates")
            }
        } else {
            console.log("Running in http mode")
        }
    }

    return stf;
};