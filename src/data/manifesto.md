---
title: "Gorilla open source"
subtitle: "the story of EntropyLab and Team Ooga Booga"
description: "How one prompt handed over on an X Space became EntropyLab, Team Ooga Booga, and gorilla open source: anyone can build software in public with an idea and a clanker."
author: "Gui"
authorHandle: "bc1gui"
date: "2026-09-04"
---

Every bitcoin private key depends on entropy. A random number becomes your keys, and the quality of that randomness decides how secure those keys can ever be. You might run singlesig with a passphrase, you might run multisig, and both are good setups. Either way, each key in them started as a random number, and for most people that number came from the generator inside a hardware wallet. Trusting it is an act of faith. You cannot see it work, and you cannot audit what it handed you.

The Coldcard incident dragged that faith into the open. People learned that a manufacturer's entropy can fail them, and the community started talking about rolling dice and generating their own entropy. Few tools exist to turn that entropy into keys on an offline device, and for years most of us leaned on one thing, Ian Coleman's BIP39 page.

The industry spent a decade marketing the "hardware wallet" as the way to generate your seed. These devices should really be called bitcoin signing devices, because signing is their job. They keep your private keys on an offline machine that can sign transactions without ever touching the internet, and you could generate your seed in other ways. Years of these devices, and the marketing behind them, got the community comfortable trusting their built-in random number generators, and that comfort became the standard. The standard concentrated trust in single vendors, and when one vendor's RNG was compromised, we got the Coldcard disaster. The lesson from the incident is that the community needs more key generation tools it can verify and trust, running offline on a device that is not compromised.

A tool like that showed up two weeks ago. It is a single HTML file by design. One file keeps the complexity down, makes the code auditable in one sitting, and runs on close to any device with a browser.

## It started with a prompt

On Monday, August 24, in the middle of an X Space, MrHodl handed Wicked a file. He had prompted it into existence, an offline bitcoin entropy calculator that refuses to generate randomness for you. You roll dice, flip coins, or paste hex, and the page turns that entropy into keys and addresses. There was no repo behind it and no plan. Wicked opened the file, saw what it could become, and had it on GitHub the same day.

<figure class="win shot" style="--win-pad:0">
<div class="win__title"><span class="win__icon" aria-hidden="true">📝</span><span class="win__name">the_prompt.txt - Notepad</span><span class="win__controls" aria-hidden="true"><span class="win__ctl">_</span><span class="win__ctl">□</span><span class="win__ctl">×</span></span></div>
<div class="win__body"><img src="/img/prompt.webp" width="946" height="619" alt="Screenshot of MrHodl's prompt to a clanker: build a single-file, fully offline HTML bitcoin calculator that never generates randomness itself and only accepts user-provided entropy such as dice rolls or hex, replicating what Ian Coleman's BIP39 tool and bitaddress.org can do. Below the prompt: Worked for 22m." loading="lazy" decoding="async" /></div>
<figcaption>fig. 1, the prompt MrHodl used. one paragraph in plain words. the clanker worked for 22 minutes.</figcaption>
</figure>

Within about a week, that file had grown into EntropyLab, an open source lab of bitcoin key tools, built by engineers and non-engineers side by side. Everyone used their own clankers, our word for AI agents, to produce code and make it the most advanced tool bitcoiners have ever created.

The handoff happened on a Space, but the idea had been brewing in public for a while. MrHodl had been posting about the gap between wallet.dat backups and seed phrases, and about what it takes to onboard normal people to self-custody. The tools he wanted did not exist, and he had never expected to be the one to build them. Clankers changed that, and they have been essential from the start. AI is what made EntropyLab possible and what turned his single prompt into the lab it is today.

<figure class="win shot" style="--win-pad:0">
<div class="win__title"><span class="win__icon" aria-hidden="true">🌐</span><span class="win__name">@MrHodl - Microsoft Internet Explorer</span><span class="win__controls" aria-hidden="true"><span class="win__ctl">_</span><span class="win__ctl">□</span><span class="win__ctl">×</span></span></div>
<div class="win__body"><img src="/img/mrhodl-post.webp" width="1062" height="788" alt="X post by Mr.Hodl, August 26, 2026: in bitcoin since December 2011, kicked out of high school in senior year, got a GED, self-taught in everything. Never thought he would help create something that helps bitcoiners worldwide, but with the LLM tools we have now that world has opened up. This isn't some big announcement, just a message that the barrier is lower than it's ever been to make something valuable. 34.5K views." loading="lazy" decoding="async" /></div>
<figcaption>fig. 2, MrHodl, two days after the handoff. "the barrier is lower than it's ever been to make something valuable."</figcaption>
</figure>

## Bring your own entropy

EntropyLab's one hard rule is that it never generates randomness. Almost every wallet asks you to trust a random number generator you cannot see, running on hardware you did not build. EntropyLab only accepts entropy you created yourself, with dice, playing cards, coin flips, or hex from any source you trust. From there it goes deep, into multisig, PSBTs, silent payments and any tools an advanced bitcoiner would want for receiving and securing bitcoin without a vendor in the loop. This much power over raw keys is dangerous, and the tool is still experimental, so do not use it to secure real bitcoin at this stage. If you want to play with it, only play with what you can afford to lose, and there is testnet support so you can try everything without risking a sat.

<figure class="win shot" style="--win-pad:0">
<div class="win__title"><span class="win__icon" aria-hidden="true">🌐</span><span class="win__name">entropylab.online - Microsoft Internet Explorer</span><span class="win__controls" aria-hidden="true"><span class="win__ctl">_</span><span class="win__ctl">□</span><span class="win__ctl">×</span></span></div>
<div class="win__body"><img src="/img/entropylab.webp" width="1568" height="805" alt="Screenshot of EntropyLab, online version. A red warning box says not to enter seed phrases, private keys, or other wallet secrets on an internet-connected device and to download the HTML file and run it offline on an air-gapped computer. Below: Hold or receive bitcoin without a signing device, with tabs for Keys, Vanity, BIP-85, Multi Signature, Silent Payments, PSBT and Journal, and a Key Station set to dice rolls." loading="lazy" decoding="async" /></div>
<figcaption>fig. 3, EntropyLab, online version. the red box at the top means what it says.</figcaption>
</figure>

## A week of shipping in public

Wicked forked the file the day he got it and started building, turning one calculator into a growing set of tools. Then contributors kept arriving and grabbing whatever needed doing. One built out the CI/CD pipeline, another fixed the frontend, others reworked the UX and reviewed code. Engineers, non-engineers, and marketers pushed to the same repo, and nobody got judged for touching code without an engineering background. The reviewers were a mix too, human engineers plus agents running models like Kimi K3, going through pull requests from people on their first repo.

All of it happened on live X Spaces. Listeners who had never opened a pull request hopped on stage, learned on the spot, and landed their first contribution to an open source project. On Wednesday, August 26, Wicked posted "Your boy is cooking. Entropy Lab coming soon." Two days from handoff to public teaser, about a week to a working lab. Work of this scope used to mean months of coordination and a budget in the hundreds of thousands of dollars.

<figure class="win shot shot--tall" style="--win-pad:0">
<div class="win__title"><span class="win__icon" aria-hidden="true">🌐</span><span class="win__name">@w_s_bitcoin - Microsoft Internet Explorer</span><span class="win__controls" aria-hidden="true"><span class="win__ctl">_</span><span class="win__ctl">□</span><span class="win__ctl">×</span></span></div>
<div class="win__body"><img src="/img/wicked-post.webp" width="1084" height="1018" alt="X post by Wicked (@w_s_bitcoin), August 26: Ur boy's cooking. EntropyLab coming soon. Attached screenshot of the tool: binary coin-flip entropy for a 24-word seed, 256 of 256 binary digits entered, all 24 seed words filled, an optional BIP39 passphrase, and the master fingerprint with and without the passphrase. 36 replies, 19 reposts, 268 likes, 13K views." loading="lazy" decoding="async" /></div>
<figcaption>fig. 4, Wicked, August 26. two days from handoff to public teaser.</figcaption>
</figure>

## Team Ooga Booga

That same week, on one of the nightly Spaces, Brian gave the group its name. The joke underneath it is that prompting is grunting. We talk to clankers in plain words, like cavemen pointing at a problem, and software comes back. A caveman could do the same, because building software now takes an ask, and intelligence is available to anyone who asks, no matter where they start. We have been getting smarter since the first prompt, but the name stays. A caveman can build. Engineers had been teasing that anyone can prompt and call themselves an engineer now, and instead of arguing we made it the brand. We renamed the main branch of the repo to rock.

The organization runs like the joke, out in the open. Meetings happen on Wicked's X Spaces, almost daily, and anyone can listen or grab the mic, from technical decisions to organizational ones. <del class="theme-replaced">The repo is public and anyone can contribute. We are not gatekeeping intelligence, and we are not pretending to be the smartest group in bitcoin.</del> <mark class="theme-update">The door is open, the work is public, and nobody is pretending to be the smartest group in bitcoin.</mark>

## Clankers reviewing clankers

The obvious objection is that this produces AI slop. Some of it starts that way. The fix is review, and clankers changed the economics of review too. Open source has always depended on many people reading the code, and agents multiply the readers. On EntropyLab, code written by non-engineers gets reviewed by engineers and by agents on frontier models, in public, with the discussion happening on a live Space.

The method matters more than the tool. We call it gorilla open source. Anyone can participate in building software, and the entry fee is your will plus a clanker. <del class="theme-replaced">You do not need a degree or permission. You need an idea, and a room that will review you in public.</del> <mark class="theme-update">You do not need permission to begin. Bring an idea, show your work, and let the room review it in public.</mark>

<aside class="win win--active msgbox" role="note" aria-label="pull quote" style="--win-pad:0.9rem 1rem 0.75rem">
<div class="win__title"><span class="win__icon" aria-hidden="true">ℹ</span><span class="win__name">gorilla open source</span></div>
<div class="win__body"><p class="msgbox__text"><span class="msgbox__i" aria-hidden="true">i</span><del class="theme-replaced">Anyone can participate in building software, and the entry fee is your will plus a clanker.</del> <mark class="theme-update">Open door. Public review. The work is the credential.</mark></p><div class="msgbox__foot"><button class="btn btn--default" type="button" data-win="close">OK</button></div></div>
</aside>

## Gorilla open source

Spaces already put our meetings in public. The next layer is Buzz, a tool where our agents talk to us and to each other in the open. Anyone can read our prompts, watch what the agents are working on, and see where the tokens go. We do it this way because we want more people to learn how to use these tools and start contributing to the ecosystem, and watching someone build is the fastest way to believe you can. If a caveman can produce working code in public, so can you.

That openness is also becoming a game. We are building one where anyone can see who is contributing to a project and what kind of work is getting done. The scoreboard comes directly from public GitHub activity: commits landed on the default branch, merged pull requests, substantive reviews, and resolved issues. Bananas stay the mascot, not the currency. Every contributor has their own character, and their character comes alive as they contribute. Over time the game is meant to grow into the entire virtual world of the open source projects we work on, where each cave is a repository. It gamifies participating, and it gives anyone who wants to understand a project a clear picture of the people and activity behind it.

<figure class="win shot" style="--win-pad:0">
<div class="win__title"><span class="win__icon" aria-hidden="true">🦍</span><span class="win__name">ooga_booga_land.exe</span><span class="win__controls" aria-hidden="true"><span class="win__ctl">_</span><span class="win__ctl">□</span><span class="win__ctl">×</span></span></div>
<div class="win__body"><img src="/img/ooga-booga-land.webp" width="1600" height="1017" alt="Screenshot of Ooga Booga Land, an island of caves: a voxel arena where blocky cavemen crowd around a pile of bananas shouting BOOGA! and BANANA!, with a bananas bar at the top, an EntropyLab sign in the world, and a loot toast at the bottom." loading="lazy" decoding="async" /></div>
<figcaption>fig. 5, Ooga Booga Land. every cave is a repository. GitHub keeps score. the cavemen are us.</figcaption>
</figure>

Buzz feeds the game directly. Everything our agents do there is published on Nostr relays, so their entire activity is tracked in the open and can be integrated into the game. The agents are characters in Ooga Booga land too, right alongside the humans.

People keep saying AI will be hard on open source. From inside EntropyLab's first weeks it looks like the opposite. Non-engineers are making a relevant impact, writing code that great engineers and clankers review and merge, and first pull requests are happening live on a Space. These weeks also exposed a clear inefficiency in how teams work today. Sometimes you are the person who knows how to fix something, or what to prompt, and you still have to go through another human to connect the dots. That middle layer is unnecessary, and tools like Buzz should remove it, for open source projects and for companies alike.

Buzz is a tool in service of the mission. Gorilla open source is the mission, our name for a massive change in how open source projects should operate, with the meetings and the prompts out in the open for anyone to join. We believe it is the beginning of something much bigger than bitcoin, because a way of building that turns anyone into a contributor should make an impact on the world. EntropyLab is the first cave. The plan is to keep swinging, building tools for bitcoin, sovereignty, and AI in the open with whoever brings an idea and a clanker.

<p class="chant">We have bananas. We eat banana. We make code. We give code to tribe.</p>
