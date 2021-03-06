document.addEventListener("DOMContentLoaded", () => {
	let statusText = document.getElementById("status-text");
	let fileBrowser = document.getElementById("file-browser");
	let progressText = document.getElementById("progress-text");
	let perfElements = [];

	let file = null;
	let sampleRate = 22050;
	
	let audioContext = null;
	let audioSource = null;
	let audioData = new Float32Array(1);
	
	let playing = false;
	let running = false;

	let worker = null;

	perfElements = document.getElementById("perf").childNodes;
	let activePerf = document.getElementById("220");

	for(let i = 0; i < perfElements.length; i++)
	{
		perfElements[i].addEventListener("click", (e) => {
			activePerf.classList.remove("active");
			activePerf = perfElements[i];
			sampleRate = parseInt(activePerf.getAttribute("value"));

			if(audioSource != null)
			{
				audioSource.disconnect(audioContext.destination);
				audioSource.stop();
			}

			audioContext = new AudioContext({sampleRate: sampleRate})
			
			audioSource = null;
			
			if(running)
			{
				worker.terminate();
				running = false;
			}

			if(file != null) fileBrowser.dispatchEvent(new Event("change"));
			perfElements[i].classList.add("active");
		});
	}

	document.getElementById("run").addEventListener("click", () => {
		if(file == null)
		{
			alert("No file selected");
			return;
		}

		let code = document.getElementById("input").value;
		RunCode(code);
	});
	
	statusText.addEventListener("click", (e) => {
		fileBrowser.click(e);
	})

	fileBrowser.addEventListener("change", () => {
		let input = Array.from(fileBrowser.files);
		
		if(audioContext == null) audioContext = new AudioContext({ sampleRate: sampleRate });
		if(input == null) return 0;

		if(running)
		{
			running = false;
			worker.terminate();
		}

		file = input[0];
		let filePath = fileBrowser.value.split('\\');
		let fileName = filePath[filePath.length-1];

		let reader = new FileReader();
		reader.onload = () => {
			let buffer = reader.result;
			audioContext.decodeAudioData(buffer, LoadAudioData);
		};

		reader.readAsArrayBuffer(file);
		statusText.innerText = `File ${fileName} loaded.`;
	});

	function PlayAudioData(data, duration = 3)
	{
		if(playing && audioSource != null)
		{
			audioSource.stop(0);
			audioSource.disconnect(audioContext.destination);
			audioSource = null;
		}
		
		audioSource = audioContext.createBufferSource();
		
		let buffer = audioContext.createBuffer(1, data.length, audioContext.sampleRate);
		buffer.getChannelData(0).set(data);
		audioSource.buffer = buffer;

		audioSource.onended = () => playing = false;

		audioSource.connect(audioContext.destination);
		audioSource.start(0, 0, duration);
		playing = true;
	}

	function LoadAudioData(data)
	{
		audioData = new Float32Array(data.length);
		audioData = data.getChannelData(0);
		PlayAudioData(audioData);
	}
	
	function CodeAnalysis(code)
	{
		code = code.replace("tau", "2*PI");
		code = code.replace("TAU", "2*PI");
		code = code.replace("pi", "PI");
		
		let mathFunctions = ["sin *\\(", "cos *\\(", "tan *\\(", "ceil *\\(", "floor *\\(", "PI", "round *\\(", "random *\\(", "abs *\\(", "atan *\\(", "atan2 *\\(", "atanh *\\(", "sinh *\\(", "cosh *\\(", "asin *\\(", "asinh *\\(", "acos *\\(", "acosh *\\(", "tanh *\\(", "pow *\\(", "sign *\\(", "sqrt *\\(", "cbrt *\\(", "log *\\(", "log10 *\\("]
		
		let mathInsertions = []

		mathFunctions.forEach((v, i) => {
			let re = new RegExp(v, 'g');
			let starts = code.matchAll(re);
			if(starts != null)
			{
				let keepGoing = true;
				while(keepGoing)
				{
					let it = starts.next();
					keepGoing = !it.done;
					if(it.value == undefined) continue;
					mathInsertions.push(it.value.index);
				}
			}
		});

		mathInsertions.sort((a,b) => a - b);		
		let index = 0;
		let newCode = [];
		const mathWord = ['M', 'a', 't', 'h', '.']
		
		for(let i = 0; i < code.length; i++)
		{
			if(mathInsertions[index] == i)
			{
				newCode = newCode.concat(mathWord);
				index += 1;
			}

			newCode.push(code[i]);
		}
		code = newCode.join('');

		return code;
	}
	
	function ErrorMessageAnalysis(message)
	{
		let words = message.split(" ");
		switch(words[0])
		{
			case "sin":
			case "cos":
			case "tan":
			case "ceil":
			case "floor":
				return message + ". Use Math.sin, Math.cos, Math.tan, Math.ceil... instead.";
			break;
			default:
				return message;
			break;
		}
	}

	function RunCode(code)
	{
		if(running) return;
		worker = new Worker("./worker.js");
		running = true;
		let count = audioData.length;
		// let newAudio = new Float32Array(count);
		let rate = audioContext.sampleRate;
		code = CodeAnalysis(code);

		worker.onmessage = (msg) => {
			running = false;
			msg = msg.data;

			switch(msg.code)
			{
				case "ok":
					let newAudio = new Float32Array(msg.new);
					audioData = new Float32Array(msg.old);
					worker.terminate();
					PlayAudioData(newAudio, msg.time)
					progressText.innerText = "100%";
				break;

				case "error":
					alert(ErrorMessageAnalysis(msg.error.message))
					audioData = new Float32Array(msg.old);
					progressText.innerText = "Error";
					worker.terminate();
				break;

				case "status":
					running = true;
					progressText.innerText = (msg.percent * 100).toFixed(2) + "%";
				break;
			}
		}

		worker.postMessage({audioData: audioData.buffer, count: count, rate: rate, code: code}, [audioData.buffer]);
		
		// for(let sample = 0; sample < audioData.length; sample++)
		// {
		// 	let value = audioData[sample];
		// 	console.log("Running " + code);
			
		// 	try
		// 	{
		// 		newAudio[sample] = eval(code);
		// 	}
		// 	catch(e)
		// 	{
		// 		alert(ErrorMessageAnalysis(e.message));
		// 		return;
		// 	}
		// }

		// PlayAudioData(newAudio, count/rate);
	}
});