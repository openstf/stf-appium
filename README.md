# stf-appium

Prototype for Appium automation Framework into Smartphone Test Farm. It provides automated parallel testing with Appium on devices in STF.

## Dependencies

Your system should have the following prerequisites set up:

  * ADB
  * a STF instance somewhere in the network
  * a working Appium installation
  * a working Node.js ecosystem
  * npm (for installating dependencies)

## Installation

After executing these command you should be ready to go:
``` Bash
git clone https://github.com/bgericke/stf-appium
npm install
```

## Configuration

The example config file looks like this:
``` JSON
{
  "appiumPath": "/path/to/appium.js",
  "appiumAddress": "127.0.0.1",
  "nodeJsPath": "node",
  "javaPath": "java",
  "adbPath": "adb",
  "outputPath": "/path/to/output",
  "ANDROID_HOME": "/path/to/android-sdk",
  "appiumPorts": {
    "rest": {
      "min": 55000,
      "max": 55999
    },
    "bootstrap": {
      "min": 56000,
      "max": 57000
    }
  },
  "devicesList": [
    "Foo",
    "Bar"
  ]
}
```

On a "normal" system, you only need to change the variables `appiumPath`, `outputPath` and `ANDROID_HOME`. But you can change all the other parameters to fit your needs.

`devicesList` is optional and will only be used, if the `--devices-list` parameter is omitted when executing `stf-appium`.

Port ranges for Appiums REST interface and bootstrap process are needed, because `stf-appium` will create multiple Appium server instances on your machine and every server needs its own ports for both.

## Execution

A full command for `stf-appium` looks like this:
``` Bash
node ./stf-appium --stf-auth-token aa165c244ace4df --stf-address https://stf.example.org:1337 --testfile ./testfile.jar --config ./config.json --output ./test-out --devices-list serial1,serial2,serial3,... --accept-selfsigned
```

An explanation for the parameters is provided by the `--help` parameter of the command line interface:
```
  Usage: stf-appium [options]

  Options:

    -h, --help                    output usage information
    -V, --version                 output the version number
    -t, --stf-auth-token <token>  Bearer auth token from STF settings
    -a, --stf-address <url>       Url/Address of STF server, if STF is running on a different port than 80, please provide url like this: http://stf.example.org:1337
    -f, --testfile <path>         Path to the test file (.jar)
    -c, --config <path>           Path to config file
    -o, --output <path>           Where to put log files and test results
    -d, --devices-list <list>     A comma separated list of device IDs, like: -d FOO2342BAR,1337H4XX0R,HX2JEKN (optional, if a devices list exists in the config file)
    -p, --apk-file <path>         Path to the .apk file of the test object app (optional)
    --accept-selfsigned           Accept self signed ssl certificate on STF server (optional)
```

### Folder hierarchy created by `stf-appium`

`stf-appium` creates the following directory and file hierarchy for each test session:

```
/path/to/output/folder
  |
  |-- <session_folder1>
  |     |
  |     |-- <device_serial1>
  |     |    |
  |     |    |-- log
  |     |    |   |-- appiumErr.log
  |     |    |   |-- appiumOut.log
  |     |    |   |-- testNgErr.log
  |     |    |   |-- testNgOut.log
  |     |    |
  |     |    |-- <files created by the test>
  |     |
  |     |-- <device_serial2>
  |     |     |
  |     |     |-- log
  |     |         |-- ...
  |     |
  |     |-- ...
  |
  |-- ...
```

## Current restrictions

Currently, the app test must be written in java and be provided as .jar file which also contains the Appium client. 
The following parameters are given to the .jar file (in the given order):

```
remoteConnectUrl  - the remoteConnectUrl from STF, for use as device serial (deviceID) in the Appium Client
mobileOS          - the mobile OS
androidVersion    - the Android version
appiumAddress     - the address of the Appium server
appiumPort        - the port of the Appium REST interface
pathToApkFile     - the path to the .apk file of the application to test
```

The newly created "device path" (`<device_serialX>` from above) for the device to test is given as the current working directory for the child process. So if your test saves its output in `./`, you should find your test output there.

Nevertheless, slight changes on the `appium.startAppiuClient()` function in `util/appium.js` should work for tests written in different languages as well.
