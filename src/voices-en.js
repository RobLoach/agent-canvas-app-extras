// Built by scripts/voices.js from Readium Speech's recommended voices
// (https://github.com/readium/speech) at commit
// 8c37650e9465e4e69551b29de2c8e96a482c46cf; edit the script instead.
// Its license, which extension.js carries along with this data:
//
// BSD 3-Clause License
//
// Copyright (c) 2024, Readium Foundation
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this
//    list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its
//    contributors may be used to endorse or promote products derived from
//    this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
// CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
// OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

export const TEST_UTTERANCE = "Hello, my name is {name} and I am an English voice.";
export const DEFAULT_REGION = "en-US";
export const VOICES = [
  {"names":["Microsoft EmmaMultilingual Online (Natural) - English (United States)","Microsoft Emma Online (Natural) - English (United States)"],"label":"Emma","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft AvaMultilingual Online (Natural) - English (United States)","Microsoft Ava Online (Natural) - English (United States)"],"label":"Microsoft Ava","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft Jenny Online (Natural) - English (United States)"],"label":"Jenny","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft Aria Online (Natural) - English (United States)"],"label":"Aria","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft Michelle Online (Natural) - English (United States)"],"label":"Michelle","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft Ana Online (Natural) - English (United States)"],"label":"Ana","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft AndrewMultilingual Online (Natural) - English (United States)","Microsoft Andrew Online (Natural) - English (United States)"],"label":"Andrew","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft BrianMultilingual Online (Natural) - English (United States)","Microsoft Brian Online (Natural) - English (United States)"],"label":"Brian","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft Guy Online (Natural) - English (United States)"],"label":"Guy","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft Eric Online (Natural) - English (United States)"],"label":"Eric","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft Steffan Online (Natural) - English (United States)"],"label":"Steffan","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft Christopher Online (Natural) - English (United States)"],"label":"Christopher","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft Roger Online (Natural) - English (United States)"],"label":"Roger","language":"en-US","quality":["veryHigh"]},
  {"names":["Microsoft Sonia Online (Natural) - English (United Kingdom)"],"label":"Sonia","language":"en-GB","quality":["veryHigh"]},
  {"names":["Microsoft Libby Online (Natural) - English (United Kingdom)"],"label":"Libby","language":"en-GB","quality":["veryHigh"]},
  {"names":["Microsoft Maisie Online (Natural) - English (United Kingdom)"],"label":"Maisie","language":"en-GB","quality":["veryHigh"]},
  {"names":["Microsoft Ryan Online (Natural) - English (United Kingdom)"],"label":"Ryan","language":"en-GB","quality":["veryHigh"]},
  {"names":["Microsoft Thomas Online (Natural) - English (United Kingdom)"],"label":"Thomas","language":"en-GB","quality":["veryHigh"]},
  {"names":["Microsoft Natasha Online (Natural) - English (Australia)"],"label":"Natasha","language":"en-AU","quality":["veryHigh"]},
  {"names":["Microsoft Hayley Online - English (Australia)"],"label":"Hayley","language":"en-AU","quality":["veryHigh"]},
  {"names":["Microsoft William Online (Natural) - English (Australia)","Microsoft WilliamMultilingual Online (Natural) - English (Australia)"],"label":"William","language":"en-AU","quality":["veryHigh"]},
  {"names":["Microsoft Clara Online (Natural) - English (Canada)"],"label":"Clara","language":"en-CA","quality":["veryHigh"]},
  {"names":["Microsoft Heather Online - English (Canada)"],"label":"Heather","language":"en-CA","quality":["veryHigh"]},
  {"names":["Microsoft Liam Online (Natural) - English (Canada)"],"label":"Liam","language":"en-CA","quality":["veryHigh"]},
  {"names":["Microsoft Neerja Online (Natural) - English (India)","Microsoft Neerja Online (Natural) - English (India) (Preview)"],"label":"Neerja","language":"en-IN","quality":["veryHigh"]},
  {"names":["Microsoft Prabhat Online (Natural) - English (India)"],"label":"Prabhat","language":"en-IN","quality":["veryHigh"]},
  {"names":["Microsoft Emily Online (Natural) - English (Ireland)"],"label":"Emily","language":"en-IE","quality":["veryHigh"]},
  {"names":["Microsoft Connor Online (Natural) - English (Ireland)"],"label":"Connor","language":"en-IE","quality":["veryHigh"]},
  {"names":["Microsoft Leah Online (Natural) - English (South Africa)"],"label":"Leah","language":"en-ZA","quality":["veryHigh"]},
  {"names":["Microsoft Luke Online (Natural) - English (South Africa)"],"label":"Luke","language":"en-ZA","quality":["veryHigh"]},
  {"names":["Microsoft Yan Online (Natural) - English (Hong Kong SAR)"],"label":"Yan","language":"en-HK","quality":["veryHigh"]},
  {"names":["Microsoft Sam Online (Natural) - English (Hongkong)"],"label":"Sam","language":"en-HK","quality":["veryHigh"]},
  {"names":["Microsoft Asilia Online (Natural) - English (Kenya)"],"label":"Asilia","language":"en-KE","quality":["veryHigh"]},
  {"names":["Microsoft Chilemba Online (Natural) - English (Kenya)"],"label":"Chilemba","language":"en-KE","quality":["veryHigh"]},
  {"names":["Microsoft Molly Online (Natural) - English (New Zealand)"],"label":"Molly","language":"en-NZ","quality":["veryHigh"]},
  {"names":["Microsoft Mitchell Online (Natural) - English (New Zealand)"],"label":"Mitchell","language":"en-NZ","quality":["veryHigh"]},
  {"names":["Microsoft Ezinne Online (Natural) - English (Nigeria)"],"label":"Ezinne","language":"en-NG","quality":["veryHigh"]},
  {"names":["Microsoft Abeo Online (Natural) - English (Nigeria)"],"label":"Abeo","language":"en-NG","quality":["veryHigh"]},
  {"names":["Microsoft Rosa Online (Natural) - English (Philippines)"],"label":"Rosa","language":"en-PH","quality":["veryHigh"]},
  {"names":["Microsoft James Online (Natural) - English (Philippines)"],"label":"James","language":"en-PH","quality":["veryHigh"]},
  {"names":["Microsoft Luna Online (Natural) - English (Singapore)"],"label":"Luna","language":"en-SG","quality":["veryHigh"]},
  {"names":["Microsoft Wayne Online (Natural) - English (Singapore)"],"label":"Wayne","language":"en-SG","quality":["veryHigh"]},
  {"names":["Microsoft Imani Online (Natural) - English (Tanzania)"],"label":"Imani","language":"en-TZ","quality":["veryHigh"]},
  {"names":["Microsoft Elimu Online (Natural) - English (Tanzania)"],"label":"Elimu","language":"en-TZ","quality":["veryHigh"]},
  {"names":["Google US English"],"label":"Female Google voice (US)","language":"en-US","quality":["high"]},
  {"names":["Google UK English Female"],"label":"Female Google voice (UK)","language":"en-GB","quality":["high"]},
  {"names":["Google UK English Male"],"label":"Male Google voice (UK)","language":"en-GB","quality":["high"]},
  {"names":["Ava"],"label":"Apple Ava","language":"en-US","quality":["low","normal","high"]},
  {"names":["Zoe"],"label":"Zoe","language":"en-US","quality":["low","normal","high"]},
  {"names":["Allison"],"label":"Allison","language":"en-US","quality":["low","normal"]},
  {"names":["Nicky"],"label":"Nicky","language":"en-US","quality":["low","normal"]},
  {"names":["Samantha"],"label":"Samantha","language":"en-US","quality":["low","normal"]},
  {"names":["Joelle"],"label":"Joelle","language":"en-US","quality":["normal"]},
  {"names":["Evan"],"label":"Evan","language":"en-US","quality":["low","normal"]},
  {"names":["Nathan"],"label":"Nathan","language":"en-US","quality":["low","normal"]},
  {"names":["Tom"],"label":"Tom","language":"en-US","quality":["low","normal"]},
  {"names":["Alex"],"label":"Alex","language":"en-US","quality":["high"]},
  {"names":["Aaron"],"label":"Aaron","language":"en-US","quality":["low"]},
  {"names":["Kate"],"label":"Kate","language":"en-GB","quality":["low","normal"]},
  {"names":["Stephanie"],"label":"Stephanie","language":"en-GB","quality":["low","normal"]},
  {"names":["Serena"],"label":"Serena","language":"en-GB","quality":["low","normal","high"]},
  {"names":["Martha"],"label":"Martha","language":"en-GB","quality":["low"]},
  {"names":["Jamie"],"label":"Jamie","language":"en-GB","quality":["low","normal","high"]},
  {"names":["Oliver"],"label":"Oliver","language":"en-GB","quality":["low","normal"]},
  {"names":["Daniel"],"label":"Daniel","language":"en-GB","quality":["low","normal"]},
  {"names":["Arthur"],"label":"Arthur","language":"en-GB","quality":["low"]},
  {"names":["Matilda"],"label":"Matilda","language":"en-AU","quality":["low","normal","high"]},
  {"names":["Karen"],"label":"Karen","language":"en-AU","quality":["low","normal","high"]},
  {"names":["Catherine"],"label":"Catherine","language":"en-AU","quality":["low"]},
  {"names":["Lee"],"label":"Lee","language":"en-AU","quality":["low","normal","high"]},
  {"names":["Gordon"],"label":"Gordon","language":"en-AU","quality":["low"]},
  {"names":["Aman","com.apple.voice.Aman"],"label":"Aman","language":"en-IN","quality":["high"]},
  {"names":["Tara","com.apple.voice.Tara"],"label":"Tara","language":"en-IN","quality":["high"]},
  {"names":["Isha"],"label":"Isha","language":"en-IN","quality":["low","normal","high"]},
  {"names":["Sangeeta"],"label":"Sangeeta","language":"en-IN","quality":["low","normal"]},
  {"names":["Veena"],"label":"Veena ","language":"en-IN","quality":["low","normal"]},
  {"names":["Rishi"],"label":"Rishi","language":"en-IN","quality":["low","normal"]},
  {"names":["Moira"],"label":"Moira","language":"en-IE","quality":["low","normal"]},
  {"names":["Tessa"],"label":"Tessa","language":"en-ZA","quality":["low","normal"]},
  {"names":["Fiona"],"label":"Fiona","language":"en-GB-u-sd-gbsct","quality":["low","normal"]},
  {"names":["Microsoft Zira - English (United States)"],"label":"Zira","language":"en-US","quality":["normal"]},
  {"names":["Microsoft David - English (United States)"],"label":"David","language":"en-US","quality":["normal"]},
  {"names":["Microsoft Mark - English (United States)"],"label":"Mark","language":"en-US","quality":["normal"]},
  {"names":["Microsoft Hazel - English (Great Britain)"],"label":"Hazel","language":"en-GB","quality":["normal"]},
  {"names":["Microsoft Susan - English (Great Britain)"],"label":"Susan","language":"en-GB","quality":["normal"]},
  {"names":["Microsoft George - English (Great Britain)"],"label":"George","language":"en-GB","quality":["normal"]},
  {"names":["Microsoft Catherine - English (Austalia)"],"label":"Catherine","language":"en-AU","quality":["normal"]},
  {"names":["Microsoft Richard - English (Australia)"],"label":"James","language":"en-AU","quality":["normal"]},
  {"names":["Microsoft Linda - English (Canada)"],"label":"Linda","language":"en-CA","quality":["normal"]},
  {"names":["Microsoft Richard - English (Canada)"],"label":"Richard","language":"en-CA","quality":["normal"]},
  {"names":["Microsoft Heera - English (India)"],"label":"Heera","language":"en-IN","quality":["normal"]},
  {"names":["Microsoft Ravi - English (India)"],"label":"Ravi","language":"en-IN","quality":["normal"]},
  {"names":["Microsoft Sean - English (Ireland)"],"label":"Sean","language":"en-IE","quality":["normal"]},
  {"names":["Google US English 5 (Natural)","Android Speech Recognition and Synthesis from Google en-us-x-tpc-network","Chrome OS US English 5","Android Speech Recognition and Synthesis from Google en-us-x-tpc-local","Android Speech Recognition and Synthesis from Google en-US-language","en-us-x-tpc-network","en-us-x-tpc-local"],"label":"Female voice 1 (US)","language":"en-US","quality":["high"]},
  {"names":["Google US English 1 (Natural)","Android Speech Recognition and Synthesis from Google en-us-x-iob-network","Chrome OS US English 1","Android Speech Recognition and Synthesis from Google en-us-x-iob-local","en-us-x-iob-network","en-us-x-iob-local"],"label":"Female voice 2 (US)","language":"en-US","quality":["high"]},
  {"names":["Google US English 2 (Natural)","Android Speech Recognition and Synthesis from Google en-us-x-iog-network","Chrome OS US English 2","Android Speech Recognition and Synthesis from Google en-us-x-iog-local","en-us-x-iog-network","en-us-x-iog-local"],"label":"Female voice 3 (US)","language":"en-US","quality":["high"]},
  {"names":["Google US English 7 (Natural)","Android Speech Recognition and Synthesis from Google en-us-x-tpf-network","Chrome OS US English 7","Android Speech Recognition and Synthesis from Google en-us-x-tpf-local","en-us-x-tpf-network","en-us-x-tpf-local"],"label":"Female voice 4 (US)","language":"en-US","quality":["high"]},
  {"names":["Android Speech Recognition and Synthesis from Google en-us-x-sfg-network","Android Speech Recognition and Synthesis from Google en-us-x-sfg-local","en-us-x-sfg-network","en-us-x-sfg-local"],"label":"Female voice 5 (US)","language":"en-US","quality":["normal"]},
  {"names":["Chrome OS US English 8"],"label":"Female voice 6 (US)","language":"en-US","quality":["low"]},
  {"names":["Google US English 4 (Natural)","Android Speech Recognition and Synthesis from Google en-us-x-iom-network","Chrome OS US English 4","Android Speech Recognition and Synthesis from Google en-us-x-iom-local","en-us-x-iom-network","en-us-x-iom-local"],"label":"Male voice 1 (US)","language":"en-US","quality":["high"]},
  {"names":["Google US English 3 (Natural)","Android Speech Recognition and Synthesis from Google en-us-x-iol-network","Chrome OS US English 3","Android Speech Recognition and Synthesis from Google en-us-x-iol-local","en-us-x-iol-network","en-us-x-iol-local"],"label":"Male voice 2 (US)","language":"en-US","quality":["high"]},
  {"names":["Google US English 6 (Natural)","Android Speech Recognition and Synthesis from Google en-us-x-tpd-network","Chrome OS US English 6","Android Speech Recognition and Synthesis from Google en-us-x-tpd-local","en-us-x-tpd-network","en-us-x-tpd-local"],"label":"Male voice 3 (US)","language":"en-US","quality":["high"]},
  {"names":["Google UK English 2 (Natural)","Android Speech Recognition and Synthesis from Google en-gb-x-gba-network","Chrome OS UK English 2","Android Speech Recognition and Synthesis from Google en-gb-x-gba-local","Android Speech Recognition and Synthesis from Google en-GB-language","en-gb-x-gba-network","en-gb-x-gba-local"],"label":"Female voice 1 (UK)","language":"en-GB","quality":["high"]},
  {"names":["Google UK English 4 (Natural)","Android Speech Recognition and Synthesis from Google en-gb-x-gbc-network","Chrome OS UK English 4","Android Speech Recognition and Synthesis from Google en-gb-x-gbc-local","en-gb-x-gbc-network","en-gb-x-gbc-local"],"label":"Female voice 2 (UK)","language":"en-GB","quality":["high"]},
  {"names":["Google UK English 6 (Natural)","Android Speech Recognition and Synthesis from Google en-gb-x-gbg-network","Chrome OS UK English 6","Android Speech Recognition and Synthesis from Google en-gb-x-gbg-local","en-gb-x-gbg-network","en-gb-x-gbg-local"],"label":"Female voice 3 (UK)","language":"en-GB","quality":["high"]},
  {"names":["Chrome OS UK English 7"],"label":"Female voice 4 (UK)","language":"en-GB","quality":["low"]},
  {"names":["Google UK English 1 (Natural)","Android Speech Recognition and Synthesis from Google en-gb-x-rjs-network","Chrome OS UK English 1","Android Speech Recognition and Synthesis from Google en-gb-x-rjs-local","en-gb-x-rjs-network","en-gb-x-rjs-local"],"label":"Male voice 1 (UK)","language":"en-GB","quality":["high"]},
  {"names":["Google UK English 3 (Natural)","Android Speech Recognition and Synthesis from Google en-gb-x-gbb-network","Chrome OS UK English 3","Android Speech Recognition and Synthesis from Google en-gb-x-gbb-local","en-gb-x-gbb-network","en-gb-x-gbb-local"],"label":"Male voice 2 (UK)","language":"en-GB","quality":["high"]},
  {"names":["Google UK English 5 (Natural)","Android Speech Recognition and Synthesis from Google en-gb-x-gbd-network","Chrome OS UK English 5","Android Speech Recognition and Synthesis from Google en-gb-x-gbd-local","en-gb-x-gbd-network","en-gb-x-gbd-local"],"label":"Male voice 3 (UK)","language":"en-GB","quality":["high"]},
  {"names":["Google Australian English 1 (Natural)","Android Speech Recognition and Synthesis from Google en-au-x-aua-network","Chrome OS Australian English 1","Android Speech Recognition and Synthesis from Google en-au-x-aua-local","Android Speech Recognition and Synthesis from Google en-AU-language","en-au-x-aua-network","en-au-x-aua-local"],"label":"Female voice 1 (Australia)","language":"en-AU","quality":["high"]},
  {"names":["Google Australian English 3 (Natural)","Android Speech Recognition and Synthesis from Google en-au-x-auc-network","Chrome OS Australian English 3","Android Speech Recognition and Synthesis from Google en-au-x-auc-local","en-au-x-auc-network","en-au-x-auc-local"],"label":"Female voice 2 (Australia)","language":"en-AU","quality":["high"]},
  {"names":["Google Australian English 2 (Natural)","Android Speech Recognition and Synthesis from Google en-au-x-aub-network","Chrome OS Australian English 2","Android Speech Recognition and Synthesis from Google en-au-x-aub-local","en-au-x-aub-network","en-au-x-aub-local"],"label":"Male voice 1 (Australia)","language":"en-AU","quality":["high"]},
  {"names":["Google Australian English 4 (Natural)","Android Speech Recognition and Synthesis from Google en-au-x-aud-network","Chrome OS Australian English 4","Android Speech Recognition and Synthesis from Google en-au-x-aud-local","en-au-x-aud-network","en-au-x-aud-local"],"label":"Male voice 2 (Australia)","language":"en-AU","quality":["high"]},
  {"names":["Chrome OS Australian English 5"],"label":"Male voice 3 (Australia)","language":"en-AU","quality":["high"]},
  {"names":["Android Speech Recognition and Synthesis from Google en-in-x-ena-network","Android Speech Recognition and Synthesis from Google en-in-x-ena-local","Android Speech Recognition and Synthesis from Google en-IN-language","en-in-x-ena-network","en-in-x-ena-local"],"label":"Female voice 1 (India)","language":"en-IN","quality":["high"]},
  {"names":["Android Speech Recognition and Synthesis from Google en-in-x-enc-network","Android Speech Recognition and Synthesis from Google en-in-x-enc-local","en-in-x-enc-network","en-in-x-enc-local"],"label":"Female voice 2 (India)","language":"en-IN","quality":["high"]},
  {"names":["Android Speech Recognition and Synthesis from Google en-in-x-end-network","Android Speech Recognition and Synthesis from Google en-in-x-end-local","en-in-x-end-network","en-in-x-end-local"],"label":"Male voice 1 (India)","language":"en-IN","quality":["high"]},
  {"names":["Android Speech Recognition and Synthesis from Google en-in-x-ene-network","Android Speech Recognition and Synthesis from Google en-in-x-ene-local","en-in-x-ene-network","en-in-x-ene-local"],"label":"Male voice 2 (India)","language":"en-IN","quality":["high"]},
];
export const HIDDEN = ["Albert","com.apple.speech.synthesis.voice.Albert","Bad News","Mauvaises nouvelles","Malas noticias","Brutte notizie","com.apple.speech.synthesis.voice.BadNews","Bahh","com.apple.speech.synthesis.voice.Bahh","Bells","Cloches","Campanas","Campane","com.apple.speech.synthesis.voice.Bells","Boing","com.apple.speech.synthesis.voice.Boing","Bubbles","Bulles","Burbujas","Bollicine","com.apple.speech.synthesis.voice.Bubbles","Cellos","Violoncelles","Violonchelos","Violoncelli","com.apple.speech.synthesis.voice.Cellos","Good News","Bonnes nouvelles","Buenas noticias","Buone notizie","com.apple.speech.synthesis.voice.GoodNews","Jester","Bouffon","Bufón","Giullare","com.apple.speech.synthesis.voice.Hysterical","Organ","Orgue","Órgano","Organo","com.apple.speech.synthesis.voice.Organ","Superstar","Superestrella","com.apple.speech.synthesis.voice.Princess","Trinoids","Trinoïdes","com.apple.speech.synthesis.voice.Trinoids","Whisper","Murmure","Susurro","Sussurro","com.apple.speech.synthesis.voice.Whisper","Wobble","com.apple.speech.synthesis.voice.Deranged","Zarvox","com.apple.speech.synthesis.voice.Zarvox","Eddy","Flo","Grandma","Grandpa","Jacques","Reed","Rocko","Sandy","Shelley","Fred","Junior","Kathy","Ralph"];
