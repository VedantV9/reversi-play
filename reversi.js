/*
  Cell entity:
  - x : Integer
  - y : Integer
  - side : Integer (1 or 2)
*/

Players = new Meteor.Collection("players");
Disks = new Meteor.Collection("disks");
var CELL_SIZE = 33; /* including border at one side */
var CELL_BORDER = 3;
var CELL_CENTER_OFFSET = CELL_BORDER + CELL_SIZE / 2;
var DISK_RADIUS = CELL_SIZE * 0.375;
var DISK_BORDER = 2;
var N = 4;
var GRID_SIZE = (CELL_SIZE) * N + CELL_BORDER;
var BG_COLOR = '#00CC66'; /* nice green */
var GRID_COLOR = '#003366'; /* dark blue */
var DISK_BORDER_COLOR = '#002E5C'; /* medium blue */
var DISK_DARK_SIDE  = '#000000'; /* dark */
var DISK_LIGHT_SIDE = '#FFFFFF'; /* bright */
var VACANT_COLOR = '#00FF00'; /* real green */
var adj = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
];
var FREE_CELL   = 0;
var VACANT_CELL = 3;

if (Meteor.isClient) {
    var cells = new Array(N);
    for (var i = 0; i < N; ++i)
        cells[i] = new Array(N);

    var drawGrid = function() {
        var canv = $('#canv')[0];
        var ctx = canv.getContext('2d');
        if (canv.width !== GRID_SIZE || canv.height !== GRID_SIZE) {
            console.log("resizing");
            canv.width = GRID_SIZE;
            canv.height = GRID_SIZE;
            $('#canv').css("width", GRID_SIZE);
            $('#canv').css("height", GRID_SIZE);
            var half = Math.floor(GRID_SIZE / 2);
            $('#first').css("width", half);
            $('#second').css("width", half);
            $('#status').css("width", 2 * half);
        }
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, canv.width, canv.height);
        var i;
        ctx.fillStyle = GRID_COLOR;
        for (i = 0; i <= N; ++i) {
            var start = i * CELL_SIZE;
            var end = start + CELL_BORDER;
            ctx.fillRect(0, i * CELL_SIZE, canv.width, CELL_BORDER);
            ctx.fillRect(i * CELL_SIZE, 0, CELL_BORDER, canv.height);
        }
    }

    var drawDisk = function (xId, yId, color, r) {
        console.log("drawDisk");
        var canv = $('#canv')[0];
        var ctx = canv.getContext('2d');
        var centerX = xId * CELL_SIZE + CELL_CENTER_OFFSET;
        var centerY = yId * CELL_SIZE + CELL_CENTER_OFFSET;
        ctx.beginPath();
        if (typeof r === 'undefined')
            r = DISK_RADIUS;
        ctx.arc(centerX, centerY, r, 0, 2 * Math.PI, false);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = DISK_BORDER;
        ctx.strokeStyle = DISK_BORDER_COLOR;
        ctx.stroke();
    }

    var cell_is_valid = function (i, j) {
        return 0 <= i && i < N && 0 <= j && j < N;
    }

    var addDisk = function (x, y, player) {
        console.log("addDisk");
        if (cells[x][y] !== VACANT_CELL) {
            console.log("Cell isn't available");
            return;
        }
        Disks.insert({x: x, y: y, side: player});
        var other = 3 - player;
        for (var k = 0; k < adj.length; ++k) {
            var dx = adj[k][0],
                dy = adj[k][1];
            var u = x + dx;
            var v = y + dy;
            var len = 0;
            while (cell_is_valid(u, v) && cells[u][v] === other) {
                u += dx;
                v += dy;
                ++len;
            }
            if (len > 0 && cell_is_valid(u, v) && cells[u][v] === player) {
                for (; len > 0; --len) {
                    u -= dx;
                    v -= dy;
                    Disks.update({_id: Disks.findOne({x: u, y: v})._id},
                        {$set: {side: player}});
                }
            }
        }
        next_move();
    }

    var mark_as_vacant = function (i, j) {
        console.log("Cell [" + i + "," + j + "] is vacant");
        cells[i][j] = VACANT_CELL;
        drawDisk(i, j, VACANT_COLOR, DISK_RADIUS / 5);
    }

    var try_find_vacant = function (player) {
        var other = 3 - player;
        var cnt = 0;
        for (var x = 0; x < N; ++x)
            for (var y = 0; y < N; ++y)
                if (cells[x][y] === player)
                    for (var k = 0; k < adj.length; ++k) {
                        var dx = adj[k][0],
                            dy = adj[k][1];
                        var u = x + dx;
                        var v = y + dy;
                        var len = 0;
                        while (cell_is_valid(u, v) && cells[u][v] === other) {
                            u += dx;
                            v += dy;
                            ++len;
                        }
                        if (len > 0 && cell_is_valid(u, v) && cells[u][v] === FREE_CELL) {
                            mark_as_vacant(u, v);
                            ++cnt;
                        }
                    }
        return cnt;
    };

    /* make sure game is running before call */
    var find_vacant = function() {
        console.log("find_vacant called");
        var player = Players.findOne({active: true}).id;
        if (try_find_vacant(player) === 0) {
            player = next_move();
            if (typeof player === 'undefined')
                return;
            if (try_find_vacant(player) === 0) {
                console.log("vacant places not found for both players");
                finish_game();
            }
        }
    }

    var game_is_running = function () {
        return Players.find({active: true}).count() === 1 &&
               Players.find({active: false}).count() === 1 &&
                Disks.find({}).count() >= 4;
    }

    var respawn = function () {
        var disks = Disks.find().count();
        for (; disks > 0; --disks)
            Disks.remove({_id: Disks.findOne({})._id});
        var players = Players.find({}).count();
        for (; players > 0; --players)
            Players.remove({_id: Players.findOne({})._id});
        var rg = Math.floor(N / 2);
        var lf = rg - 1;
        Disks.insert({x: lf, y: lf, side: 1});
        Disks.insert({x: rg, y: rg, side: 1});
        Disks.insert({x: lf, y: rg, side: 2});
        Disks.insert({x: rg, y: lf, side: 2});
        Players.insert({id: 1, active: true});
        Players.insert({id: 2, active: false});
    }

    var next_move = function () {
        var active = Players.findOne({active: true});
        var inactive = Players.findOne({active: false});
        if (typeof active !== 'undefined' && typeof inactive !== 'undefined') {
            Players.update({_id: inactive._id}, {$set: {active: true}});
            Players.update({_id: active._id}, {$set: {active: false}});
            return inactive.id;
        }
        return undefined;
    }

    var finish_game = function () {
        var active = Players.findOne({active: true});
        var inactive = Players.findOne({active: false});
        if (typeof active !== 'undefined' && typeof inactive !== 'undefined')
            Players.update({_id: active._id}, {$set: {active: false}});
    }

    Template.board.events({
        'click #canv' : (function (event) {
            console.log("Canvas clicked");
            if (!game_is_running())
                return;
            var canv = $('#canv')[0];
            var canvOffsetX = canv.offsetLeft;
            var canvOffsetY = canv.offsetTop;
            var x = event.pageX - canvOffsetX,
                y = event.pageY - canvOffsetY;
            if (x % CELL_SIZE < CELL_BORDER || y % CELL_SIZE < CELL_BORDER) {
                console.log("miss: border");
                return;
            }
            var xId = Math.floor(x / CELL_SIZE);
            var yId = Math.floor(y / CELL_SIZE);
            if (xId >= N || yId >= N) {
                console.log("miss: rightmost or bottom border");
                return;
            }
            console.log("hit cell " + xId + "," + yId);
            addDisk(xId, yId, Players.findOne({active: true}).id);
        }),
        'click #reset_button' : (function (event) {
            console.log("Reset button clicked");
            respawn();
        })
    });

    Template.board.rendered = function () {
        var self = this;
        if (!self.handle) {
            self.handle = Deps.autorun(function () {
                drawGrid();
                var disks = Disks.find();
                for (var i = 0; i < N; ++i)
                    for (var j = 0; j < N; ++j)
                        cells[i][j] = FREE_CELL;
                disks.forEach(function(disk) {
                    drawDisk(disk.x, disk.y,
                        disk.side === 1 ? DISK_DARK_SIDE : DISK_LIGHT_SIDE);
                    cells[disk.x][disk.y] = disk.side;
                });
                if (game_is_running())
                    find_vacant();
            });
        }
    };

    var calc_game_status = function () {
        var player1 = Players.findOne({id: 1})
        var player2 = Players.findOne({id: 2})
        if (typeof player1 === 'undefined' || typeof player2 === 'undefined')
            return;
        var first_cnt = Disks.find({side: 1}).count();
        var second_cnt = Disks.find({side: 2}).count();
        var result = {
            first: {
                score: first_cnt
            },
            second: {
                score: second_cnt
            },
        };
        result.first.css = "wait_move";
        result.second.css = "wait_move";
        if (player1.active) {
            result.first.css = "do_move";
        } else if (player2.active) {
            result.second.css = "do_move";
        } else {
            if (first_cnt === second_cnt) {
                result.game_result = "Draw";
            } else if(first_cnt > second_cnt) {
                result.game_result = "Dark side won, Luke!";
            } else {
                result.game_result = "Light side won, Luke!";
            }
        }
        if (typeof result.game_result === 'undefined')
            result.game_result = "";
        return result;
    }

    Template.game_status.rendered = function () {
        var self = this;
        if (!self.handle) {
            self.handle = Deps.autorun(function () {
                console.log("game_status rendered called");
                var stat = calc_game_status();
                if (typeof stat === 'undefined')
                    return;
                var status = "<div id=\"first\" class=\"" + stat.first.css + "\">\n";
                status += "Dark side: " + stat.first.score + "\n";
                status += "</div>\n";
                status += "<div id=\"second\" class=\"" + stat.second.css + "\">\n";
                status += "Light side: " + stat.second.score + "\n";
                status += "</div>\n";
                var html = "<div id=\"status\">\n" + status + "</div><br />\n" +
                    "<div style=\"clear:both\">" +
                    stat.game_result + "\n</div>\n";
                console.log("html = " + html);
                $('#game_info').html(html);
            });
        }
    };
}

if (Meteor.isServer) {
    Meteor.startup(function () {
        // code to run on server at startup
    });
}
