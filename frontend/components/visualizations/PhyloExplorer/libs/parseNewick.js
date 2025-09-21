export function parseNewick(a) {
  if (a) {
    for (
      var e = [], r = {}, s = a.split(/\s*(;|\(|\)|,|:)\s*/), t = 0;
      t < s.length;
      t++
    ) {
      var n = s[t];
      switch (n) {
        case "(":
          var c = {};
          (r.branchset = [c]), e.push(r), (r = c);
          break;
        case ",":
          // eslint-disable-next-line no-redeclare
          var c = {};
          e[e.length - 1].branchset.push(c), (r = c);
          break;
        case ")":
          r = e.pop();
          break;
        case ":":
          break;
        default:
          var h = s[t - 1];
          ")" == h || "(" == h || "," == h
            ? (r.name = n)
            : ":" == h && (r.length = parseFloat(n));
      }
    }
    return r;
  } else {
    return {}
  }
}
