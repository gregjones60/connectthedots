﻿//  ---------------------------------------------------------------------------------
//  Copyright (c) Microsoft Open Technologies, Inc.  All rights reserved.
// 
//  The MIT License (MIT)
// 
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
// 
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
// 
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//  ---------------------------------------------------------------------------------

function onLoading(evt) {
    $('#loading').show();
    if (evt.owner) {
        $('#loading-sensor').text(evt.owner);
    }
}

function onLoaded(evt) {
    $('#loading').hide();
}

function onError(evt) {
    $('#messages').prepend('<div>ERROR ' + evt.owner + '</div>');
}

function onOpen(evt) {
    $('#messages').prepend('<div>Connected.</div>');
}

function onNewEvent(evt) {
    var eventObject = evt.owner;
    var flowCnt = dataFlows.length;

    // auto add flows
    if (flowCnt >= 0 && flowCnt < 4 && eventObject.hasOwnProperty('guid')) {
        var found = false;
        for (var i = 0; i < flowCnt ; ++i) {
            if (dataFlows[i].getGUID() == eventObject.guid) {
                found = true;
                break;
            }
        }
        if (!found) {
            var newFlow = new d3DataFlow(eventObject.guid);
            dataFlows.push(newFlow);
            if (flowCnt < 2) {
                dataChartOne.addFlow(newFlow, flowCnt);
            } else {
                dataChartTwo.addFlow(newFlow, flowCnt - 2);
            }

            $('#sensorList').append("<li id='flow" + eventObject.guid + "' value='" + (flowCnt + 1) + "'>loading...</li>");

            newFlow.addEventListener('change', function (evt) {
                document.getElementById('flow' + evt.owner.getGUID()).innerHTML = evt.owner.displayName();

            });

        }
    }


    if (eventObject.alerttype != null) {
        var table = $('#alertTable').DataTable();
        var time = new Date(eventObject.timestart);

        // Log the alert in the rawalerts div
        $('#rawalerts').prepend('<div>' + time + ': ' + eventObject.dsplalert + ' ' + eventObject.alerttype + ' ' + eventObject.message + '</div>');
        $('#rawalerts').contents().filter(':gt(20)').remove();

        // Check if we already have this one in the table already to prevent duplicates
        var indexes = table.rows().eq(0).filter(function (rowIdx) {
            if (
                table.cell(rowIdx, 0).data().getTime() == time.getTime() && table.cell(rowIdx, 1).data() == eventObject.dsplalert && table.cell(rowIdx, 2).data() == eventObject.alerttype) {
                return true;
            }
            return false;
        });

        // The alert is a new one, lets display it
        if (indexes.length == 0) {
            // For performance reasons, we want to limit the number of items in the table to a max of 20. 
            // We will remove the oldest from the list
            if (table.data().length > 19) {
                // Search for the oldest time in the list of alerts
                var minTime = table.data().sort(

                    function (a, b) {
                        return (a[0] > b[0]) - (a[0] < b[0])
                    })[0][0];
                // Delete the oldest row
                table.rows(

                    function (idx, data, node) {
                        return data[0].getTime() == minTime.getTime();
                    }).remove();
            }

            // Add the new alert to the table
            var message = 'message';
            if (eventObject.message != null) message = eventObject.message;
            table.row.add([
                time,
                eventObject.dsplalert,
                eventObject.alerttype,
                message
            ]).draw();

        }
    }
}

//
// JQuery ready function
//

var dataFlows = [];
var dataChartOne = null;
var dataChartTwo = null;

$(document).ready(function () {

    // create datasource
    var sss = (window.location.protocol.indexOf('s') > 0 ? "s" : "");
    var uri = 'ws' + sss + '://' + window.location.host + '/api/websocketconnect?clientId=none';

    $('#messages').prepend('<div> Connecting to ' + uri + '<div>');
    var dataSource = new d3CTDDataSourceSocket(uri).addEventListeners({ 'eventObject': onNewEvent, 'error': onError, 'open': onOpen });

    // create flows
    //var dataFlows = [new d3DataFlow('4dee9a68-0000-0000-0000-000000000000'), new d3DataFlow('339490f3-0000-0000-0000-000000000000'), new d3DataFlow('43a8c699-0000-0000-0000-000000000000'), new d3DataFlow('0bcb6a5d-0000-0000-0000-000000000000')];

    // create charts
    dataChartOne = (new d3Chart('chartOne'))
        .addEventListeners({ 'loading': onLoading, 'loaded': onLoaded })
        .attachToDataSource(dataSource);

    dataChartTwo = (new d3Chart('chartTwo'))
        .addEventListeners({ 'loading': onLoading, 'loaded': onLoaded })
        .attachToDataSource(dataSource);

    //  Handle a sensor selection change
    // 'All' means all dataset are shown.
    //  Anything else toggles that particular
    //  dataset

    $('#sensorList').on('click', 'li', function () {
        var device = this.value > 0 ? dataFlows[this.value - 1].getGUID() : 'All';
        dataSource.changeDeviceGUID(device);
        $('#sensorList li').each(function () {
            $(this).removeClass('selected');
        });
        $(this).addClass('selected');
    });

    // create alerts table
    var table = $('#alertTable').DataTable({
        "bAutoWidth": false,
        "bFilter": true,
        "bInfo": true,
        "paging": true,
        "order": [
            [0, "desc"]
        ],
        "columnDefs": [{
            "targets": "timeFromDate",
            "data": function (row, type, val, meta) {
                if (type === 'set') {
                    row[meta.col] = val;
                    return;
                } else if (type === 'display') {
                    return row[meta.col].toLocaleTimeString();
                }
                return row[meta.col];
            }
        }, {
            "targets": "numberFixed",
            "data": function (row, type, val, meta) {
                if (type === 'set') {
                    row[meta.col] = val;
                    return;
                } else if (type === 'display') {
                    return row[meta.col].toFixed(1);
                }
                return row[meta.col];
            }
        }, ]
    });
});