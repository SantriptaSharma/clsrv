onmessage = (msg) => {
	let input = msg.data;

	let count = input.count;
	let list = new Float32Array(input.audioData);
	let rate = input.rate;
	let newAudio = new Float32Array(count);

	for(let sample = 0; sample < count; sample++)
	{
		let value = list[sample];
		
		try
		{
			newAudio[sample] = eval(input.code);
		}
		catch(error)
		{
			postMessage({code: "error", error: error, old: list.buffer}, [list.buffer]);
			return;
		}

		if(sample%2500 == 0)
		{
			postMessage({code: "status", percent: sample/count});
		}
	}

	postMessage({code: "ok", old: list.buffer, new: newAudio.buffer, time: count/rate}, [newAudio.buffer, list.buffer]);
}