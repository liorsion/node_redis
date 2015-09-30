'use strict';

var assert = require("assert");
var config = require("./lib/config");
var helper = require('./helper');
var redis = config.redis;

describe("on lost connection", function () {
    helper.allTests(function(parser, ip, args) {

        describe("using " + parser + " and " + ip, function () {

            it("emit an error after max retry attempts and do not try to reconnect afterwards", function (done) {
                var max_attempts = 4;
                var client = redis.createClient({
                    parser: parser,
                    max_attempts: max_attempts
                });
                var calls = 0;

                client.once('ready', function() {
                    helper.killConnection(client);
                });

                client.on("reconnecting", function (params) {
                    calls++;
                });

                client.on('error', function(err) {
                    if (/Redis connection in broken state: maximum connection attempts.*?exceeded./.test(err.message)) {
                        setTimeout(function () {
                            assert.strictEqual(calls, max_attempts - 1);
                            done();
                        }, 1500);
                    }
                });
            });

            it("emit an error after max retry timeout and do not try to reconnect afterwards", function (done) {
                var connect_timeout = 1000; // in ms
                var client = redis.createClient({
                    parser: parser,
                    connect_timeout: connect_timeout
                });
                var time = 0;

                client.once('ready', function() {
                    helper.killConnection(client);
                });

                client.on("reconnecting", function (params) {
                    time += params.delay;
                });

                client.on('error', function(err) {
                    if (/Redis connection in broken state: connection timeout.*?exceeded./.test(err.message)) {
                        setTimeout(function () {
                            assert(time === connect_timeout);
                            done();
                        }, 1500);
                    }
                });
            });

            it("end connection while retry is still ongoing", function (done) {
                var connect_timeout = 1000; // in ms
                var client = redis.createClient({
                    parser: parser,
                    connect_timeout: connect_timeout
                });

                client.once('ready', function() {
                    helper.killConnection(client);
                });

                client.on("reconnecting", function (params) {
                    client.end();
                    setTimeout(done, 100);
                });
            });

            it("can not connect with wrong host / port in the options object", function (done) {
                var client = redis.createClient({
                    host: 'somewhere',
                    port: 6379,
                    max_attempts: 1
                });
                var end = helper.callFuncAfter(done, 2);

                client.on('error', function (err) {
                    assert(/CONNECTION_BROKEN|ENOTFOUND/.test(err.code));
                    end();
                });

            });

            it("connect with host and port provided in the options object", function (done) {
                var client = redis.createClient({
                    host: 'localhost',
                    port: '6379',
                    parser: parser,
                    connect_timeout: 1000
                });

                client.once('ready', function() {
                    done();
                });
            });

        });
    });
});
