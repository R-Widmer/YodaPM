//  Copyright 2018 Hewlett Packard Enterprise Development LP
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software 
// and associated documentation files (the "Software"), to deal in the Software without restriction, 
// including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
// and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, 
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or 
// substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR 
// PURPOSE AND NONINFRINGEMENT.
//
// IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR 
// OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF 
// OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


// Global variable controlling whether bars should be stacked or not.
// If stacked, then tool will not do a "totals" line and a corresponding right axis.

var repoList = [];  // selected repos
var repoMilestones = []; // Double-array of repos,milestone (full structure) for selected repos

var commonMilestones = []; // Options for milestone selection (milestones in all repos).
var milestoneList = []; // selected milestones just the title
var milestoneListComplete = []; // selected milestones, full structure.

var repoIssues = []; // List of issues. Full structure as returned from github.

var download = false; // global - a bit of a hack.

function addIfNotDefault(params, field) {
	var defaultValue = $("#" + field).prop('defaultValue');
	// Hack. Make sure no real newlines into default value.
	defaultValue = defaultValue.replace(/\n/g, "");
	var value = $("#" + field).val();
	
	if (value != defaultValue) {
		console.log("value: " + value);
		console.log("defa : " + defaultValue);
		return params + "&" + field + "=" + value; 
	} else {
		return params;
	}
}

function getUrlParams() {
	var params = "owner=" + $("#owner").val();
	if ($("#repolist").val() != "")
		params += "&repolist=" + $("#repolist").val();
	if ($("#milestonelist").val() != "")
		params += "&milestonelist=" + $("#milestonelist").val();
	params = addIfNotDefault(params, "rnlabeltypes");
	params = addIfNotDefault(params, "rnskiplabel");
	params = addIfNotDefault(params, "rnmetalabel");
	params = addIfNotDefault(params, "rnknownlabel");
	
	params = addIfNotDefault(params, "hlformat");
	params = addIfNotDefault(params, "sformat");
	params = addIfNotDefault(params, "ssformat");
	params = addIfNotDefault(params, "listformat");
	params = addIfNotDefault(params, "rnformat");
	
	var outputFormat = $('input:radio[name="outputformat"]:checked').val();
	if (outputFormat != "html")
		params += "&outputformat=" + outputFormat;

	if ($('#closedmilestones').is(":checked")) {
		params += "&closedmilestones=true";
	}
	if ($('#tablelayout').is(":checked")) {
		params += "&tablelayout=true";
	}
	
	return params;
}

function copy_text(element) {
    //Before we copy, we are going to select the text.
    var text = document.getElementById(element);
    var selection = window.getSelection();
    selection.removeAllRanges();
    var range = document.createRange();
    range.selectNodeContents(text);

    selection.addRange(range);

    // Now that we've selected element, execute the copy command  
    try {  
        var successful = document.execCommand('copy');  
        var msg = successful ? 'successful' : 'unsuccessful';  
        console.log('Copy to clipboard command was ' + msg);  
      } catch(err) {  
        console.log('Oops, unable to copy to clipboard');  
      }

    // Remove selection. TBD: Remove, when copy works.
    // selection.removeAllRanges();
}

// Remove elements in array that have duplicates based on a given field.
function uniqueArray(arr, field) {
	return arr.filter(function(element, index, array, thisArg) {return array.findIndex(function(e, i, a, t) 
			{if (index != i && element[field] == e[field]) return true; else return false;}) == -1;});
}

// --------
// Add issues, making sure to avoid duplicates.
function addIssues(oldIssues, newIssues) {
	return uniqueArray(oldIssues.concat(newIssues), "url");
}

function getFormat(formatArray, index) {
	var f = formatArray[index]; 
	f = f.replace(/\\n/g, '\n');
	return f;
}

//Parse RN markdown to HTML (if any)
function parseRNMarkdown(markdown) {
	var markdownUrl = yoda.getGithubUrl() + "markdown";
	console.log("markdownUrl: " + markdownUrl);

	var urlData = {
			"text": markdown
	};
	
	var result = "";
	$.ajax({
		url: markdownUrl,
		type: 'POST',
		async: false, 
		data: JSON.stringify(urlData),
		success: function(data) { result = data;},
		error: function() { yoda.showSnackbarError("Failed to translate Markdown"); },
		complete: function(jqXHR, textStatus) { }
	});
	
	return result;
}


//Create a List node to based on the given issue.
function formatIssueRN(issue) {
	var rnFormat = $("#rnformat").val();
	var repo = yoda.getUrlRepo(issue.repository_url);
	
	if ($('input:radio[name="outputformat"]:checked').val()== "html") 
		var newLine = "<br>";
	else
		var newLine = "&lt;br&gt;";
	
	var issueText = "";
	var issueRNTStart = issue.body.indexOf('> RNT');
	if (issueRNTStart == -1)
		issueRNTStart = issue.body.indexOf('>RNT');
	
	if (issueRNTStart != -1) {
		var lineStart = issue.body.indexOf('\n', issueRNTStart) + 1;
		var lineEnd = issue.body.indexOf('\n', lineStart);
		if (lineEnd == -1)
			var line = issue.body.substr(lineStart);
		else
			var line = issue.body.substr(lineStart, lineEnd - lineStart - 1);
		var title = line;
	} else {
		var title = issue.title;
	}

	var rnText = "";
	
	var issueRNSearchStart = 0;
	if (issueRNTStart != -1)
		issueRNSearchStart = issueRNTStart + 1;
	var issueRNStart = issue.body.indexOf('> RN', issueRNSearchStart);
	if (issueRNStart == -1)
		issueRNStart = issue.body.indexOf('>RN', issueRNSearchStart);
	if (issueRNStart != -1) {
		var lineStart = issue.body.indexOf('\n', issueRNStart) + 1;
		rnText = "";

		do {
			var lineEnd = issue.body.indexOf('\n', lineStart);
			if (lineEnd == -1)
				var line = issue.body.substr(lineStart);
			else
				var line = issue.body.substr(lineStart, lineEnd - lineStart - 1);
			if (line.length == 0)
				break;
			if (rnText != "") 
				rnText += newLine;
			rnText += line;

			if (lineEnd == -1) {
				break;
			}

			lineStart = lineEnd + 1;
		} while (true);

		// HTML?
		if ($('input:radio[name="outputformat"]:checked').val()== "html") {
			rnText = parseRNMarkdown(rnText);
		}
	}

	// substitude into template
	issueText = rnFormat;
	issueText = issueText.replace(/%t/, title);
	issueText = issueText.replace(/%d/, repo + "#" + issue.number);
	issueText = issueText.replace(/%n/, issue.number);
	issueText = issueText.replace(/%r/, rnText);
	
	if (rnText != "") {
		issueText = issueText.replace(/%y/, rnText);
		if ($('input:radio[name="outputformat"]:checked').val()== "html") { 
			issueText = issueText.replace(/%x/, rnText);
		} else {
			issueText = issueText.replace(/%x/, newLine + newLine + rnText);
		}
	} else { 
		issueText = issueText.replace(/%x/, "");
		issueText = issueText.replace(/%y/, title);
	}
	
	return issueText;
}

function makeRN() {
	var rn = document.getElementById("RN");
	
	var repoList = $("#repolist").val();
	var rnText = "";
	
	// T2 - Enhancements|Added Features,T1 - Defect|Solved Issues
	var rnLabelTypes = $("#rnlabeltypes").val();
	var rnLabelTypesList = rnLabelTypes.split(",");
	
	// Skip label
	var rnSkipLabel = $("#rnskiplabel").val();

//  Will be something like...
//	var issueTypeList = ["T2 - Enhancement", "T1 - Defect"];
//	var issueTypeHeading = ["Added Features", "Solved Issues"];
	
	// Get formatting
	var hlFormat = $("#hlformat").val().split(",");
	var sFormat = $("#sformat").val().split(",");
	var ssFormat = $("#ssformat").val().split(",");
	var listFormat = $("#listformat").val().split(",");

	// Headline
	rnText += getFormat(hlFormat, 0) + "Release Notes for " + $("#milestonelist").val() + getFormat(hlFormat, 1);

	for (var r = 0; r < repoList.length; r++) {
		rnText += getFormat(sFormat, 0) + "Changes for " + repoList[r] + getFormat(sFormat, 1);
		
		for (var t = 0; t < rnLabelTypesList.length; t++) {
	
			var rnList = "";
			for (var i = 0; i < repoIssues.length; i++) {
				// Match repo?.
				var repository = repoIssues[i].repository_url.split("/").splice(-1); // Repo name is last element in the url
				if (repository != repoList[r])
					continue;
				
				// Match issue type (in label)
				if (!yoda.isLabelInIssue(repoIssues[i], rnLabelTypesList[t].split("|")[0]))
					continue;
				
				// Should issue be skipped
				if (yoda.isLabelInIssue(repoIssues[i], rnSkipLabel))
					continue;
				
				rnList += getFormat(listFormat, 2) + formatIssueRN(repoIssues[i]) + getFormat(listFormat, 3);
			}

			if (rnList != "") {
				// Put header and list, but only if non-empty.
				rnText += getFormat(ssFormat, 0) + rnLabelTypesList[t].split("|")[1] + getFormat(ssFormat, 1);
				rnText += getFormat(listFormat, 0) + rnList + getFormat(listFormat, 1);
			}
		}
	}
	
	if ($('input:radio[name="outputformat"]:checked').val() == "html") {
		rn.innerHTML = rnText;
	} else {
		rn.innerHTML = "<pre>" + rnText + "</pre>";
	}

	// Download?
	if (download) {
		var fileName = $("#filename").val() + "." + $('input:radio[name="outputformat"]:checked').val();
		console.log("Downloading to " + fileName);
		var appType = "application/" + $('input:radio[name="outputformat"]:checked').val() + ";charset=utf-8;";
		yoda.downloadFileWithType(appType, rnText, fileName);		
	}

	// Copy to clipboard
	copy_text("RN");
	yoda.updateUrl(getUrlParams() + "&draw=rn");
}


function makeKnown() {
	// Get formatting
	var hlFormat = $("#hlformat").val().split(",");
	var sFormat = $("#sformat").val().split(",");
	var ssFormat = $("#ssformat").val().split(",");
	var listFormat = $("#listformat").val().split(",");

	var rn = document.getElementById("RN");
	
	var repoList = $("#repolist").val();
	var rnText = "";
	
	// Skip label
	var rnSkipLabel = $("#rnskiplabel").val();
	
	// Headline
	rnText += getFormat(hlFormat, 0) + "Known Issues" + getFormat(hlFormat, 1);
	
	for (var r = 0; r < repoList.length; r++) {
		
		var rnList = "";
		for (var i = 0; i < repoIssues.length; i++) {
			// Match repo?.
			var repository = repoIssues[i].repository_url.split("/").splice(-1); // Repo name is last element in the url
			if (repository != repoList[r])
				continue;

			// Should issue be skipped
			if (yoda.isLabelInIssue(repoIssues[i], rnSkipLabel))
				continue;

			rnList += getFormat(listFormat, 2) + formatIssueRN(repoIssues[i]) + getFormat(listFormat, 3);
		}
		
		if (rnList != "") {
			rnText += getFormat(sFormat, 0) + "Known Issues for " + repoList[r] + getFormat(sFormat, 1);
			rnText += getFormat(listFormat, 0) + rnList + getFormat(listFormat, 1);
		}
	}
	
	if ($('input:radio[name="outputformat"]:checked').val() == "html") {
		rn.innerHTML = rnText;

	} else {
		rn.innerHTML = "<pre>" + rnText + "</pre>";
	}
	
	// Download?
	if (download) {
		var fileName = $("#filename").val() + "." + $('input:radio[name="outputformat"]:checked').val();
		console.log("Downloading to " + fileName);
		var appType = "application/" + $('input:radio[name="outputformat"]:checked').val() + ";charset=utf-8;";
		yoda.downloadFileWithType(appType, rnText, fileName);		
	}

	// Copy to clipboard
	copy_text("RN");
	yoda.updateUrl(getUrlParams() + "&draw=known");
}

// -----------

function startRN(_download) {
	download = _download;
	updateIssuesForRN();
}

function startKnown(_download) {
	download = _download;
	updateIssuesKnown();
}

// ---------------

function updateRepos() {
	yoda.updateReposAndGUI($("#owner").val(), "#repolist", "repolist", "yoda.repolist", null, null);
}

// -------------

function storeMilestones(milestones, repoIndex) {
	repoMilestones[repoIndex] = milestones;
	updateMilestones(repoIndex + 1);
}

var firstMilestoneShow = true;
function updateMilestones(repoIndex) {
	if (repoIndex == undefined) {
		repoIndex = 0;
	}
	
	if (repoIndex < repoList.length) {
		if ($('#closedmilestones').is(":checked")) {
			var getMilestonesUrl = yoda.getGithubUrl() + "repos/" + $("#owner").val() + "/" + repoList[repoIndex] + "/milestones?state=all";
		} else {
			var getMilestonesUrl = yoda.getGithubUrl() + "repos/" + $("#owner").val() + "/" + repoList[repoIndex] + "/milestones?state=open";
		}
		console.log("Milestone get URL: " + getMilestonesUrl);
		
		yoda.getLoop(getMilestonesUrl, 1, [], function(data) {storeMilestones(data, repoIndex);}, null);
	} else {
		var selectMilestones = [];
		if (firstMilestoneShow) {
			firstMilestoneShow = false;
			var urlMilestoneList = yoda.decodeUrlParam(null, "milestonelist");
			if (urlMilestoneList != null) 
				selectMilestones = urlMilestoneList.split(",");
		}
		
		// Done getting milestones for all selected repos
		// Next, find common milestones and update milestones selector.
		$("#milestonelist").empty();
		commonMilestones = [];
		
		for (var r = 0; r < repoList.length; r++) {
			for (var m = 0; m < repoMilestones[r].length; m++) {
				var repoTitle = repoMilestones[r][m].title;
				
				if (commonMilestones.indexOf(repoTitle) == -1) {
					commonMilestones.push(repoTitle);
				}
			}
		}
		
		// Sort and add
		commonMilestones.sort();
		console.log("The common milestones are: " + commonMilestones);
		var milestonesSelected = false;
		for (var c = 0; c < commonMilestones.length; c++) {
			var selectMilestone = false;
			if (selectMilestones.indexOf(commonMilestones[c]) != -1) { 
				selectMilestone = true;
				milestonesSelected = true;
			}
			
			var newOption = new Option(commonMilestones[c], commonMilestones[c], selectMilestone, selectMilestone);
			$('#milestonelist').append(newOption);
		}
		
		if (milestonesSelected)
			$('#milestonelist').trigger('change');
	}
}

// -------------



function storeIssues(issues, milestoneIndex, myUpdateIssueActiveNo) {
	if (myUpdateIssueActiveNo < updateIssueActiveNo) {
		console.log("Update is not latest. Cancelling...");
		// I'm out of date. cancel
		return;
	}
	
//	repoIssues = repoIssues.concat(issues);
	repoIssues = addIssues(repoIssues, issues);
	console.log("total number of issues now: "  + repoIssues.length);
	updateIssueLoop(milestoneIndex + 1, myUpdateIssueActiveNo);
}

function updateMetaIssuesThenRN(metaIssuesList) {
	if (metaIssuesList.length > 0) {
		var getIssueUrl = metaIssuesList[0];
		yoda.getLoop(getIssueUrl, -1, [], function(data) {repoIssues = addIssues(repoIssues, data); metaIssuesList.splice(0, 1); updateMetaIssuesThenRN(metaIssuesList);}, null);
	} else {
		// Let's sort issues on number. This may be required as we allow to retrieve issues from different milestones.
		// Sort by repository, number
		repoIssues.sort(function(a,b) {
			if (a.repository_url == b.repository_url) {
				return (a.number - b.number); 
			}
			if (a.repository_url > b.repository_url) {
				return 1;
			} else {
				return -1;
			}
		});
	
		console.log("No issues (after filtering out pull requests): " + repoIssues.length);
		yoda.showSnackbarOk("Succesfully retrived " + repoIssues.length + " issues.");
		makeRN();
	}
}

var updateIssueActiveNo = 0;
function updateIssueLoop(milestoneIndex, myUpdateIssueActiveNo) {
	if (myUpdateIssueActiveNo < updateIssueActiveNo) {
		console.log("Update is not latest. Cancelling...");
		// I'm out of date. cancel
		return;
	}
	
	console.log("UpdateIssueLoop: " + milestoneIndex);
	if (milestoneIndex < milestoneListComplete.length) {
		var milestone = milestoneListComplete[milestoneIndex];
		var repo = yoda.getRepoFromMilestoneUrl(milestone.url);
	
		var milestoneSearch = "&milestone=" + milestone.number;
		console.log("milestone.number: " + milestone.number);

		var getIssuesUrl = yoda.getGithubUrl() + "repos/" + $("#owner").val() + "/" + repo + "/issues?state=all&direction=asc" + milestoneSearch;
//		console.log(getIssuesUrl);
		
		yoda.getLoop(getIssuesUrl, 1, [], function(data) {storeIssues(data, milestoneIndex, myUpdateIssueActiveNo)}, null);
	} else {
		// Requested (and received all issues).
		console.log("All issues (before filtering out pull requests): " + repoIssues.length);
		yoda.filterPullRequests(repoIssues);
		
		// Is this a good place to handle Meta-issues?
		var metaIssuesList = [];
		var rnMetaLabel = $("#rnmetalabel").val();
		for (var i = 0; i < repoIssues.length; i++) {
			// Meta issue? Special handling required
			if (yoda.isLabelInIssue(repoIssues[i], rnMetaLabel)) {
				console.log("Meta issue: " + repoIssues[i].number);
			
				var metaStart = repoIssues[i].body.indexOf('> META ');
				if (metaStart == -1) {
					console.log("Could not find META tag????");
				} else {
					var lineEnd = repoIssues[i].body.indexOf('\n', metaStart);
					if (lineEnd == -1)
						lineEnd = repoIssues[i].body.length;

					var metaLine = repoIssues[i].body.substr(metaStart + 7, lineEnd);
					var issuesRawList = metaLine.split(/\s+/);
					console.log(issuesRawList);

					for (var j = 0; j < issuesRawList.length; j++) {
						if (issuesRawList[j].indexOf("#") == -1)
							continue;
						var ref = issuesRawList[j].trim().replace(/#/g, "");
						var urlRef = repoIssues[i].url.replace(/\/[0-9]+$/g, "/" + ref);
						metaIssuesList.push(urlRef);
					}
				}
			}
		}
		updateMetaIssuesThenRN(metaIssuesList);
	}
}

function updateIssuesForRN() {
	updateIssueActiveNo++;
	console.log("UpdateIssueActive: " + updateIssueActiveNo);
		
	// Ok, here we go. This is the tricky part.
	// We will get issues for all selected milestones for all selected repos.
	milestoneListComplete = [];
	
	for (var m = 0; m < milestoneList.length; m++) {
//		console.log("Updating issues for milestone: " + milestoneList[m]);

		for (var r = 0; r < repoList.length; r++) {
//			console.log("  For repo: " + repoList[r]);
			// Need to find the milestone (the number)..
			for (var m1 = 0; m1 < repoMilestones[r].length; m1++) {
//				console.log(repoMilestones[r][m1].title);
				if (repoMilestones[r][m1].title == milestoneList[m]) {
					console.log("Need to get issues for " + repoList[r] + ", " + milestoneList[m] + ", which has number: " + repoMilestones[r][m1].number);
					milestoneListComplete.push(repoMilestones[r][m1]);
				}
			}
		}
	}
	
	console.log("Total list of milestones for which to get issues");
	console.log(milestoneListComplete);
	
	repoIssues = [];
	
	updateIssueLoop(0, updateIssueActiveNo);
}

// --------------

function updateIssuesKnownLoop(repoRemainList, issues) {
//	repoIssues = repoIssues.concat(issues);
	repoIssues = addIssues(repoIssues, issues);

	console.log(repoRemainList);
	if (repoRemainList.length == 0) {
		makeKnown();
		return;
	}
	
	var repo = repoRemainList[0];
	var newRemain = repoRemainList.slice(0);
	newRemain.splice(0, 1);
	console.log(newRemain);
	
	var getIssuesUrl = yoda.getGithubUrl() + "repos/" + $("#owner").val() + "/" + repo + "/issues?state=open&labels=" + $("#rnknownlabel").val();
	yoda.getLoop(getIssuesUrl, 1, [], function(data) {updateIssuesKnownLoop(newRemain, data)}, null);
}

function updateIssuesKnown() {
	repoIssues = [];
	
	updateIssuesKnownLoop(repoList, []);
} 

// --------------

function githubAuth() {
	console.log("Github authentisation: " + $("#user").val() + ", token: " + $("#token").val());
	yoda.gitAuth($("#user").val(), $("#token").val());
}

// --------------


function setDefaultAndValue(id, value) {
	element = document.getElementById(id);
	element.defaultValue = value;
	element.value = value;
}

function changeOutput() {
	value = $('input:radio[name="outputformat"]:checked').val();
	switch (value) {
	case "html":
		if ($('#tablelayout').is(":checked")) {
			// HPE SA format
			setDefaultAndValue("hlformat", "<H1>,</H1>\\n");
			setDefaultAndValue("sformat", "<H2>,</H2>\\n");
			setDefaultAndValue("ssformat", "<H3>,</H3>\\n");
			setDefaultAndValue("listformat", "<table><thead><tr><th width=10%>Number</th><th width=90%>Description</th></tr></thead><tbody>\n,</tbody></table>\n,<tr>\n,</tr>\n");
			setDefaultAndValue("rnformat", "<td>%d</td><td>%t%r")
		} else {
			setDefaultAndValue("hlformat", "<H1>,</H1>\\n");
			setDefaultAndValue("sformat", "<H2>,</H2>\\n");
			setDefaultAndValue("ssformat", "<H3>,</H3>\\n");
			setDefaultAndValue("listformat", "<UL>\\n,</UL>\\n,<LI>\\n,</LI>\\n");
			setDefaultAndValue("rnformat", "%t (%d)<BLOCKQUOTE>%r</BLOCKQUOTE>");
		}
		break;

	case "md":
	case "rst":  // Note: for now same as md
		if ($('#tablelayout').is(":checked")) {
			setDefaultAndValue("hlformat", "# ,\\n\\n");
			setDefaultAndValue("sformat", "## ,\\n\\n");
			setDefaultAndValue("ssformat", "### ,\\n\\n");
			setDefaultAndValue("listformat", "Number | Description\\n--------|-------------\\n,\\n,,\\n");
			setDefaultAndValue("rnformat", "%d | %t%x");
		} else {
			setDefaultAndValue("hlformat", "# ,\\n\\n");
			setDefaultAndValue("sformat", "## ,\\n\\n");
			setDefaultAndValue("ssformat", "### ,\\n\\n");
			setDefaultAndValue("listformat", ",,-  ,\\n");
			setDefaultAndValue("rnformat", "%t (%d)%x");
		}
		break;
	}
}