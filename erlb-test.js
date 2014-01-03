function erlb_test() {
    equal(new Int8Array([131,100,0,5,104,101,108,108,111]), Erl.encode(Erl.atom("hello")));
}
