function simpleThrow() {
	throw Error('haha');
}

function nestedThrow() {
	if (true) {
		for (let i = 0; i < 2; i++) {
			if (1 + 2 == 3) {
				let j = i;
			}
			else {
				throw 1;
			}
		}
	}
}