//--------------- Side causes ---------------

function sideCause(x, y) {
	let a = 0;
	a = x;
	// Side cause: read from non-local var / param (1)
	a = z;
	// Side cause: read from non-local member (2)
	a = t.e[4].x;
	// Side cause inside string template (3)
	return `some interpolated ${foo} text`;
}

function sideCauseThis(x, y) {
	let a = 0;
	// Side cause: read from this (1)
	a = this;
	// Side cause: read from this member (2)
	a = this.b[4];
}

function objLiteral() {
	// Side cause: read from non-local 'bar' (1)
	return {
		foo: bar
	}
}

function noErrorsHere(x, y) {
	x.fooBar();
	return x[y];
}

function sideCauseInvokeFunction(x) {
	// This is allowed
	x.f1();
	x.y[3].z.f2();
	// Side cause: invoke member function of non-local (1)
	foo.f3();
	// Side cause: invoke member function of non-local, nested (2)
	foo.a.b[3].c.f4();

}