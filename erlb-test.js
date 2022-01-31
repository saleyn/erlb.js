// erlb-test.js
// ============
// Copyright (c) 2013 Serge Aleynikov <saleyn@gmail.com>
// See BSD for licensing information.
//
// Test cases for erlb.js using QUnit testing framework
//    http://api.qunitjs.com

function erlb_test() {
    function doTest(msg, actual, expected, opts = {}) {
        deepEqual(Erl.bufferToArray(Erl.encode(actual, opts)), expected, "Encode " + msg);
        deepEqual(Erl.decode(Erl.toArrayBuffer(expected), opts), actual, "Decode " + msg);
    }

    // -- Test encoding --
    doTest("string",        "abcd",             [131,107,0,4,97,98,99,100]);
    doTest("atom",          Erl.atom("hello"),  [131,100,0,5,104,101,108,108,111]);
    doTest("undefined",     undefined,          [131,100,0,9,117,110,100,101,102,105,110,101,100]);
    doTest("null",          null,               [131,100,0,4,110,117,108,108]);
    doTest("bool(true)",    true,               [131,100,0,4,116,114,117,101]);
    doTest("bool(false)",   false,              [131,100,0,5,102,97,108,115,101]);
    doTest("int(0)",        0,                  [131,97,0]);
    doTest("int(255)",      255,                [131,97,255]);
    doTest("int(-1)",       -1,                 [131,98,255,255,255,255]);
    doTest("int(1 << 48)",  281474976710656,    [131,110,7,0,0,0,0,0,0,0,1]);
    doTest("int(-((1<<48)+257))",-281474976710913,[131,110,7,1,1,1,0,0,0,0,1]);
    doTest("float(123.4)",  123.4,              [131,70,64,94,217,153,153,153,153,154]);
    doTest("float(-1.5e-3)",-1.5e-3,            [131,70,191,88,147,116,188,106,126,250]);
    doTest("pid", Erl.pid("a@b",48,0,0),        [131,103,100,0,3,97,64,98,0,0,0,48,0,0,0,0,0]);
    doTest("ref", Erl.ref("a@b",0,[154,1,2]),   [131,114,0,3,100,0,3,97,64,98,0,0,0,0,154,0,0,0,1,0,0,0,2]);
    doTest("binary", Erl.binary([1,2,3,4]),     [131,109,0,0,0,4,1,2,3,4]);
    doTest('tuple{1,"a",3.1}', Erl.tuple(1,"a",3.1), [131,104,3,97,1,107,0,1,97,70,64,8,204,204,204,204,204,205]);
    doTest('list[]',        [],                 [131,106]);
    doTest('list[1,"a",3.1]', [1,"a",3.1],      [131,108,0,0,0,3,97,1,107,0,1,97,70,64,8,204,204,204,204,
                                                 204,205,106]);
    doTest("tuple{1,\"a\",{'x',23,[]},true}",
        Erl.tuple(1,"a",Erl.tuple(Erl.atom('x'),23,[]),true),
                                                [131,104,4,97,1,107,0,1,97,104,3,100,0,1,120,97,23,106,
                                                 100,0,4,116,114,117,101]);
    doTest('proplist[{a,1},{b,[1,"a"]},{c,[]},{d,10.1},{e,"abc"}]',
        [{a:1},{b:[1,"a"]},{c:[]},{d:10.1},{e:"abc"}],
                                                [131,108,0,0,0,5,104,2,100,0,1,97,97,1,104,2,100,0,1,98,108,0,0,0,2,97,1,107,
                                                 0,1,97,106,104,2,100,0,1,99,106,104,2,100,0,1,100,70,64,36,51,51,51,51,51,51,
                                                 104,2,100,0,1,101,107,0,3,97,98,99,106]);
    doTest('#map{<<"a">> => 1, <<"b">> => 2}',
        {a:1,b:2},                              [131,116,0,0,0,2,109,0,0,0,1,97,97,1,109,0,0,0,1,98,97,2]);
    doTest('#map{<<"a">> => 1, <<"b">> => 2}',
        {a:1,b:2},                              [131,116,0,0,0,2,109,0,0,0,1,97,97,1,109,0,0,0,1,98,97,2], {mapKeyType: 'binary'});
    doTest('#map{a => 1, b => 2}',
        {a:1,b:2},                              [131,116,0,0,0,2,100,0,1,97,97,1,100,0,1,98,97,2], {mapKeyType: 'atom'});
    doTest('#map{"a" => 1, "b" => 2}',
        {a:1,b:2},                              [131,116,0,0,0,2,107,0,1,97,97,1,107,0,1,98,97,2], {mapKeyType: 'string'});

    // -- Test stringification --
    equal(Erl.toString("abc"),                  '"abc"',        'Erl.toString("abc")');
    equal(Erl.toString(Erl.atom("abc")),        "abc",          "Erl.toString(ErlAtom(abc))");
    equal(Erl.toString(Erl.atom("Xy")),         "'Xy'",         "Erl.toString(ErlAtom('Xy'))");
    equal(Erl.toString(Erl.binary([1,2,3])),    "<<1,2,3>>",    "Erl.toString(ErlBinary(<<1,2,3>>))");
    equal(Erl.toString(Erl.binary([65,66,67])), '<<"ABC">>',    'Erl.toString(ErlBinary(<<"ABC">>)');
    equal(Erl.toString(Erl.binary([1,2,3]), {compact: true}),    "`1,2,3`",  "Erl.toString(ErlBinary(<<1,2,3>>), {compact: true})");
    equal(Erl.toString(Erl.binary([65,66,67]), {compact: true}), '`ABC`',    'Erl.toString(ErlBinary(<<"ABC">>), {compact: true}');
    equal(Erl.toString(undefined),              "undefined",    "Erl.toString(undefined)");
    equal(Erl.toString(null),                   "null",         "Erl.toString(null)");
    equal(Erl.toString(true),                   "true",         "Erl.toString(Boolean)");
    equal(Erl.toString(123456),                 "123456",       "Erl.toString(Int)");
    equal(Erl.toString(123.456),                "123.456",      "Erl.toString(Float)");
    equal(Erl.toString(Erl.pid("a@b",1,2,3)),   "#pid{a@b,1,2}", "Erl.toString(Pid)");
    equal(Erl.toString(Erl.ref("a@b",0,[1,2,3])),"#ref{a@b,1,2,3}", "Erl.toString(Ref)");
    equal(Erl.toString(Erl.tuple(1,"abc",[])),  '{1,"abc",[]}', "Erl.toString(ErlTuple)");
    equal(Erl.toString([1,"a",[],Erl.tuple(1,Erl.atom('b'))]), '[1,"a",[],{1,b}]', "Erl.toString(List)");
    equal(Erl.toString({a:1, b:[1,2], c:"abc"}), '[{a,1},{b,[1,2]},{c,"abc"}]', "Erl.toString(PropList)");
}
