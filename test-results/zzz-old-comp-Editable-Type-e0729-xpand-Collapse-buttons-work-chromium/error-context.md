# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zzz-old-comp.spec.js >> Editable Types - Comprehensive Functionality >> Idea Type >> [Idea] Expand/Collapse buttons work
- Location: tests/e2e/zzz-old-comp.spec.js:152:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#addIdeaBtn')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "MyWork - v2026.08.19.42" [ref=e4] [cursor=pointer]:
        - /url: /
      - generic [ref=e5]:
        - button "  Default" [ref=e6] [cursor=pointer]:
          - generic [ref=e7]: 
          - generic [ref=e8]:
            - generic [ref=e9]: 
            - text: Default
        - text: 
      - link "Settings" [ref=e10] [cursor=pointer]:
        - /url: /settings
        - generic [ref=e11]: 
  - generic [ref=e12]:
    - tablist [ref=e13]:
      - button "⭐ Work Items" [ref=e14] [cursor=pointer]:
        - generic [ref=e15]: ⭐
        - text: Work Items
      - button "📋 Templates" [ref=e16] [cursor=pointer]:
        - generic [ref=e17]: 📋
        - text: Templates
      - listitem [ref=e18]
      - tab "📍 Projects" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: 📍
        - text: Projects
      - tab "🏷️ Categories" [ref=e21] [cursor=pointer]:
        - generic [ref=e22]: 🏷️
        - text: Categories
      - tab "🎯 Goals" [ref=e23] [cursor=pointer]:
        - generic [ref=e24]: 🎯
        - text: Goals
      - tab "✅ Todos" [ref=e25] [cursor=pointer]:
        - generic [ref=e26]: ✅
        - text: Todos
      - tab "📝 Tasks" [ref=e27] [cursor=pointer]:
        - generic [ref=e28]: 📝
        - text: Tasks
      - tab "🎟️ Tickets" [ref=e29] [cursor=pointer]:
        - generic [ref=e30]: 🎟️
        - text: Tickets
      - tab "💡 Ideas" [active] [ref=e31] [cursor=pointer]:
        - generic [ref=e32]: 💡
        - text: Ideas
      - listitem [ref=e33]
      - button "📊 Priority Board" [ref=e34] [cursor=pointer]:
        - generic [ref=e35]: 📊
        - text: Priority Board
      - tab "📈 Reporting" [ref=e36] [cursor=pointer]:
        - generic [ref=e37]: 📈
        - text: Reporting
    - generic [ref=e38]:
      - complementary [ref=e39]:
        - generic [ref=e40]:
          - button " Calendar" [ref=e42] [cursor=pointer]:
            - generic [ref=e43]: 
            - text: Calendar
          - generic [ref=e44]:
            - tabpanel [ref=e47]:
              - generic [ref=e48]:
                - generic [ref=e49]:
                  - button "Previous month" [ref=e50] [cursor=pointer]: ‹
                  - heading "August 2026" [level=6] [ref=e51]
                  - button "Next month" [ref=e52] [cursor=pointer]: ›
                - table [ref=e53]:
                  - rowgroup [ref=e54]:
                    - row [ref=e55]:
                      - columnheader "Sun" [ref=e56]
                      - columnheader "Mon" [ref=e57]
                      - columnheader "Tue" [ref=e58]
                      - columnheader "Wed" [ref=e59]
                      - columnheader "Thu" [ref=e60]
                      - columnheader "Fri" [ref=e61]
                      - columnheader "Sat" [ref=e62]
                    - row [ref=e63]:
                      - cell [ref=e64]
                      - cell [ref=e65]
                      - cell [ref=e66]
                      - cell [ref=e67]
                      - cell [ref=e68]
                      - cell [ref=e69]
                      - cell "1" [ref=e70] [cursor=pointer]
                    - row [ref=e71]:
                      - cell "2" [ref=e72] [cursor=pointer]
                      - cell "3" [ref=e73] [cursor=pointer]
                      - cell "4" [ref=e74] [cursor=pointer]
                      - cell "5" [ref=e75] [cursor=pointer]
                      - cell "6" [ref=e76] [cursor=pointer]
                      - cell "7" [ref=e77] [cursor=pointer]
                      - cell "8" [ref=e78] [cursor=pointer]
                    - row [ref=e79]:
                      - cell "9" [ref=e80] [cursor=pointer]
                      - cell "10" [ref=e81] [cursor=pointer]
                      - cell "11" [ref=e82] [cursor=pointer]
                      - cell "12" [ref=e83] [cursor=pointer]
                      - cell "13" [ref=e84] [cursor=pointer]
                      - cell "14" [ref=e85] [cursor=pointer]
                      - cell "15" [ref=e86] [cursor=pointer]
                    - row [ref=e87]:
                      - cell "16" [ref=e88] [cursor=pointer]
                      - cell "17" [ref=e89] [cursor=pointer]
                      - cell "18" [ref=e90] [cursor=pointer]
                      - cell "19" [ref=e91] [cursor=pointer]
                      - cell "20" [ref=e92] [cursor=pointer]
                      - cell "21" [ref=e93] [cursor=pointer]
                      - cell "22" [ref=e94] [cursor=pointer]
                    - row [ref=e95]:
                      - cell "23" [ref=e96] [cursor=pointer]
                      - cell "24" [ref=e97] [cursor=pointer]
                      - cell "25" [ref=e98] [cursor=pointer]
                      - cell "26" [ref=e99] [cursor=pointer]
                      - cell "27" [ref=e100] [cursor=pointer]
                      - cell "28" [ref=e101] [cursor=pointer]
                      - cell "29" [ref=e102] [cursor=pointer]
                    - row [ref=e103]:
                      - cell "30" [ref=e104] [cursor=pointer]
                      - cell "31" [ref=e105] [cursor=pointer]
                      - cell [ref=e106]
                      - cell [ref=e107]
                      - cell [ref=e108]
                      - cell [ref=e109]
                      - cell [ref=e110]
            - generic [ref=e114]:
              - heading "Work Items for Thursday, Aug 20" [level=6] [ref=e116]
              - paragraph [ref=e118]: Nothing on this day yet - drag a type or a template in to get started.
        - text:                    
      - text:                 
      - generic [ref=e120]:
        - text:                                                                                                                                                                                                                                                                     
        - generic [ref=e124]:
          - generic [ref=e125]:
            - group [ref=e127]:
              - button " Expand All" [ref=e128] [cursor=pointer]:
                - generic [ref=e129]: 
                - text: Expand All
              - button " Collapse All" [ref=e130] [cursor=pointer]:
                - generic [ref=e131]: 
                - text: Collapse All
            - group [ref=e133]:
              - button " + Folder" [ref=e134] [cursor=pointer]:
                - generic [ref=e135]: 
                - text: + Folder
              - button "+ New Idea" [ref=e136] [cursor=pointer]
          - text: 
          - generic [ref=e138]:
            - generic [ref=e139]:
              - generic "Drag to reorder columns" [ref=e140]:
                - button "Title" [ref=e141] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=e142]:
                - button "Priority" [ref=e143] [cursor=pointer]
              - generic "Drag to reorder columns" [ref=e144]:
                - button "Status" [ref=e145] [cursor=pointer]
              - group [ref=e147]:
                - button "" [ref=e148] [cursor=pointer]
                - button "" [ref=e150] [cursor=pointer]
            - generic [ref=e152]:
              - generic [ref=e155]:
                - generic [ref=e156]:
                  - generic [ref=e157]: 💡
                  - generic [ref=e158]: Bob
                - button "Low - click for Medium" [ref=e160] [cursor=pointer]
                - button "Raw" [ref=e167] [cursor=pointer]
                - button "Delete" [ref=e169] [cursor=pointer]:
                  - generic [ref=e170]: 
              - generic [ref=e173]:
                - generic [ref=e174]:
                  - generic [ref=e175]: 💡
                  - generic [ref=e176]: "2"
                - button "No priority - click for Low" [ref=e178] [cursor=pointer]
                - button "Raw" [ref=e185] [cursor=pointer]
                - button "Delete" [ref=e187] [cursor=pointer]:
                  - generic [ref=e188]: 
              - generic [ref=e191]:
                - generic [ref=e192]:
                  - generic [ref=e193]: 💡
                  - generic [ref=e194]: New Goal Test
                - button "No priority - click for Low" [ref=e196] [cursor=pointer]
                - button "Raw" [ref=e203] [cursor=pointer]
                - button "Delete" [ref=e205] [cursor=pointer]:
                  - generic [ref=e206]: 
              - generic [ref=e209]:
                - generic [ref=e210]:
                  - generic [ref=e211]: 💡
                  - generic [ref=e212]: New Goal Test
                - button "No priority - click for Low" [ref=e214] [cursor=pointer]
                - button "Raw" [ref=e221] [cursor=pointer]
                - button "Delete" [ref=e223] [cursor=pointer]:
                  - generic [ref=e224]: 
              - generic [ref=e227]:
                - generic [ref=e228]:
                  - generic [ref=e229]: 💡
                  - generic [ref=e230]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e232] [cursor=pointer]
                - button "Raw" [ref=e239] [cursor=pointer]
                - button "Delete" [ref=e241] [cursor=pointer]:
                  - generic [ref=e242]: 
              - generic [ref=e245]:
                - generic [ref=e246]:
                  - generic [ref=e247]: 💡
                  - generic [ref=e248]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e250] [cursor=pointer]
                - button "Raw" [ref=e257] [cursor=pointer]
                - button "Delete" [ref=e259] [cursor=pointer]:
                  - generic [ref=e260]: 
              - generic [ref=e263]:
                - generic [ref=e264]:
                  - generic [ref=e265]: 💡
                  - generic [ref=e266]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e268] [cursor=pointer]
                - button "Raw" [ref=e275] [cursor=pointer]
                - button "Delete" [ref=e277] [cursor=pointer]:
                  - generic [ref=e278]: 
              - generic [ref=e281]:
                - generic [ref=e282]:
                  - generic [ref=e283]: 💡
                  - generic [ref=e284]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e286] [cursor=pointer]
                - button "Raw" [ref=e293] [cursor=pointer]
                - button "Delete" [ref=e295] [cursor=pointer]:
                  - generic [ref=e296]: 
              - generic [ref=e299]:
                - generic [ref=e300]:
                  - generic [ref=e301]: 💡
                  - generic [ref=e302]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e304] [cursor=pointer]
                - button "Raw" [ref=e311] [cursor=pointer]
                - button "Delete" [ref=e313] [cursor=pointer]:
                  - generic [ref=e314]: 
              - generic [ref=e317]:
                - generic [ref=e318]:
                  - generic [ref=e319]: 💡
                  - generic [ref=e320]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e322] [cursor=pointer]
                - button "Raw" [ref=e329] [cursor=pointer]
                - button "Delete" [ref=e331] [cursor=pointer]:
                  - generic [ref=e332]: 
              - generic [ref=e335]:
                - generic [ref=e336]:
                  - generic [ref=e337]: 💡
                  - generic [ref=e338]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e340] [cursor=pointer]
                - button "Raw" [ref=e347] [cursor=pointer]
                - button "Delete" [ref=e349] [cursor=pointer]:
                  - generic [ref=e350]: 
              - generic [ref=e353]:
                - generic [ref=e354]:
                  - generic [ref=e355]: 💡
                  - generic [ref=e356]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e358] [cursor=pointer]
                - button "Raw" [ref=e365] [cursor=pointer]
                - button "Delete" [ref=e367] [cursor=pointer]:
                  - generic [ref=e368]: 
              - generic [ref=e371]:
                - generic [ref=e372]:
                  - generic [ref=e373]: 💡
                  - generic [ref=e374]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e376] [cursor=pointer]
                - button "Raw" [ref=e383] [cursor=pointer]
                - button "Delete" [ref=e385] [cursor=pointer]:
                  - generic [ref=e386]: 
              - generic [ref=e389]:
                - generic [ref=e390]:
                  - generic [ref=e391]: 💡
                  - generic [ref=e392]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e394] [cursor=pointer]
                - button "Raw" [ref=e401] [cursor=pointer]
                - button "Delete" [ref=e403] [cursor=pointer]:
                  - generic [ref=e404]: 
              - generic [ref=e407]:
                - generic [ref=e408]:
                  - generic [ref=e409]: 💡
                  - generic [ref=e410]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e412] [cursor=pointer]
                - button "Raw" [ref=e419] [cursor=pointer]
                - button "Delete" [ref=e421] [cursor=pointer]:
                  - generic [ref=e422]: 
              - generic [ref=e425]:
                - generic [ref=e426]:
                  - generic [ref=e427]: 💡
                  - generic [ref=e428]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e430] [cursor=pointer]
                - button "Raw" [ref=e437] [cursor=pointer]
                - button "Delete" [ref=e439] [cursor=pointer]:
                  - generic [ref=e440]: 
              - generic [ref=e443]:
                - generic [ref=e444]:
                  - generic [ref=e445]: 💡
                  - generic [ref=e446]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e448] [cursor=pointer]
                - button "Raw" [ref=e455] [cursor=pointer]
                - button "Delete" [ref=e457] [cursor=pointer]:
                  - generic [ref=e458]: 
              - generic [ref=e461]:
                - generic [ref=e462]:
                  - generic [ref=e463]: 💡
                  - generic [ref=e464]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e466] [cursor=pointer]
                - button "Raw" [ref=e473] [cursor=pointer]
                - button "Delete" [ref=e475] [cursor=pointer]:
                  - generic [ref=e476]: 
              - generic [ref=e479]:
                - generic [ref=e480]:
                  - generic [ref=e481]: 💡
                  - generic [ref=e482]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e484] [cursor=pointer]
                - button "Raw" [ref=e491] [cursor=pointer]
                - button "Delete" [ref=e493] [cursor=pointer]:
                  - generic [ref=e494]: 
              - generic [ref=e497]:
                - generic [ref=e498]:
                  - generic [ref=e499]: 💡
                  - generic [ref=e500]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e502] [cursor=pointer]
                - button "Raw" [ref=e509] [cursor=pointer]
                - button "Delete" [ref=e511] [cursor=pointer]:
                  - generic [ref=e512]: 
              - generic [ref=e515]:
                - generic [ref=e516]:
                  - generic [ref=e517]: 💡
                  - generic [ref=e518]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e520] [cursor=pointer]
                - button "Raw" [ref=e527] [cursor=pointer]
                - button "Delete" [ref=e529] [cursor=pointer]:
                  - generic [ref=e530]: 
              - generic [ref=e533]:
                - generic [ref=e534]:
                  - generic [ref=e535]: 💡
                  - generic [ref=e536]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e538] [cursor=pointer]
                - button "Raw" [ref=e545] [cursor=pointer]
                - button "Delete" [ref=e547] [cursor=pointer]:
                  - generic [ref=e548]: 
              - generic [ref=e551]:
                - generic [ref=e552]:
                  - generic [ref=e553]: 💡
                  - generic [ref=e554]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e556] [cursor=pointer]
                - button "Raw" [ref=e563] [cursor=pointer]
                - button "Delete" [ref=e565] [cursor=pointer]:
                  - generic [ref=e566]: 
              - generic [ref=e569]:
                - generic [ref=e570]:
                  - generic [ref=e571]: 💡
                  - generic [ref=e572]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e574] [cursor=pointer]
                - button "Raw" [ref=e581] [cursor=pointer]
                - button "Delete" [ref=e583] [cursor=pointer]:
                  - generic [ref=e584]: 
              - generic [ref=e587]:
                - generic [ref=e588]:
                  - generic [ref=e589]: 💡
                  - generic [ref=e590]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e592] [cursor=pointer]
                - button "Raw" [ref=e599] [cursor=pointer]
                - button "Delete" [ref=e601] [cursor=pointer]:
                  - generic [ref=e602]: 
              - generic [ref=e605]:
                - generic [ref=e606]:
                  - generic [ref=e607]: 💡
                  - generic [ref=e608]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e610] [cursor=pointer]
                - button "Raw" [ref=e617] [cursor=pointer]
                - button "Delete" [ref=e619] [cursor=pointer]:
                  - generic [ref=e620]: 
              - generic [ref=e623]:
                - generic [ref=e624]:
                  - generic [ref=e625]: 💡
                  - generic [ref=e626]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e628] [cursor=pointer]
                - button "Raw" [ref=e635] [cursor=pointer]
                - button "Delete" [ref=e637] [cursor=pointer]:
                  - generic [ref=e638]: 
              - generic [ref=e641]:
                - generic [ref=e642]:
                  - generic [ref=e643]: 💡
                  - generic [ref=e644]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e646] [cursor=pointer]
                - button "Raw" [ref=e653] [cursor=pointer]
                - button "Delete" [ref=e655] [cursor=pointer]:
                  - generic [ref=e656]: 
              - generic [ref=e659]:
                - generic [ref=e660]:
                  - generic [ref=e661]: 💡
                  - generic [ref=e662]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e664] [cursor=pointer]
                - button "Raw" [ref=e671] [cursor=pointer]
                - button "Delete" [ref=e673] [cursor=pointer]:
                  - generic [ref=e674]: 
              - generic [ref=e677]:
                - generic [ref=e678]:
                  - generic [ref=e679]: 💡
                  - generic [ref=e680]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e682] [cursor=pointer]
                - button "Raw" [ref=e689] [cursor=pointer]
                - button "Delete" [ref=e691] [cursor=pointer]:
                  - generic [ref=e692]: 
              - generic [ref=e695]:
                - generic [ref=e696]:
                  - generic [ref=e697]: 💡
                  - generic [ref=e698]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e700] [cursor=pointer]
                - button "Raw" [ref=e707] [cursor=pointer]
                - button "Delete" [ref=e709] [cursor=pointer]:
                  - generic [ref=e710]: 
              - generic [ref=e713]:
                - generic [ref=e714]:
                  - generic [ref=e715]: 💡
                  - generic [ref=e716]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e718] [cursor=pointer]
                - button "Raw" [ref=e725] [cursor=pointer]
                - button "Delete" [ref=e727] [cursor=pointer]:
                  - generic [ref=e728]: 
              - generic [ref=e731]:
                - generic [ref=e732]:
                  - generic [ref=e733]: 💡
                  - generic [ref=e734]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e736] [cursor=pointer]
                - button "Raw" [ref=e743] [cursor=pointer]
                - button "Delete" [ref=e745] [cursor=pointer]:
                  - generic [ref=e746]: 
              - generic [ref=e749]:
                - generic [ref=e750]:
                  - generic [ref=e751]: 💡
                  - generic [ref=e752]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e754] [cursor=pointer]
                - button "Raw" [ref=e761] [cursor=pointer]
                - button "Delete" [ref=e763] [cursor=pointer]:
                  - generic [ref=e764]: 
              - generic [ref=e767]:
                - generic [ref=e768]:
                  - generic [ref=e769]: 💡
                  - generic [ref=e770]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e772] [cursor=pointer]
                - button "Raw" [ref=e779] [cursor=pointer]
                - button "Delete" [ref=e781] [cursor=pointer]:
                  - generic [ref=e782]: 
              - generic [ref=e785]:
                - generic [ref=e786]:
                  - generic [ref=e787]: 💡
                  - generic [ref=e788]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e790] [cursor=pointer]
                - button "Raw" [ref=e797] [cursor=pointer]
                - button "Delete" [ref=e799] [cursor=pointer]:
                  - generic [ref=e800]: 
              - generic [ref=e803]:
                - generic [ref=e804]:
                  - generic [ref=e805]: 💡
                  - generic [ref=e806]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e808] [cursor=pointer]
                - button "Raw" [ref=e815] [cursor=pointer]
                - button "Delete" [ref=e817] [cursor=pointer]:
                  - generic [ref=e818]: 
              - generic [ref=e821]:
                - generic [ref=e822]:
                  - generic [ref=e823]: 💡
                  - generic [ref=e824]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e826] [cursor=pointer]
                - button "Raw" [ref=e833] [cursor=pointer]
                - button "Delete" [ref=e835] [cursor=pointer]:
                  - generic [ref=e836]: 
              - generic [ref=e839]:
                - generic [ref=e840]:
                  - generic [ref=e841]: 💡
                  - generic [ref=e842]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e844] [cursor=pointer]
                - button "Raw" [ref=e851] [cursor=pointer]
                - button "Delete" [ref=e853] [cursor=pointer]:
                  - generic [ref=e854]: 
              - generic [ref=e857]:
                - generic [ref=e858]:
                  - generic [ref=e859]: 💡
                  - generic [ref=e860]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e862] [cursor=pointer]
                - button "Raw" [ref=e869] [cursor=pointer]
                - button "Delete" [ref=e871] [cursor=pointer]:
                  - generic [ref=e872]: 
              - generic [ref=e875]:
                - generic [ref=e876]:
                  - generic [ref=e877]: 💡
                  - generic [ref=e878]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e880] [cursor=pointer]
                - button "Raw" [ref=e887] [cursor=pointer]
                - button "Delete" [ref=e889] [cursor=pointer]:
                  - generic [ref=e890]: 
              - generic [ref=e893]:
                - generic [ref=e894]:
                  - generic [ref=e895]: 💡
                  - generic [ref=e896]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e898] [cursor=pointer]
                - button "Raw" [ref=e905] [cursor=pointer]
                - button "Delete" [ref=e907] [cursor=pointer]:
                  - generic [ref=e908]: 
              - generic [ref=e911]:
                - generic [ref=e912]:
                  - generic [ref=e913]: 💡
                  - generic [ref=e914]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e916] [cursor=pointer]
                - button "Raw" [ref=e923] [cursor=pointer]
                - button "Delete" [ref=e925] [cursor=pointer]:
                  - generic [ref=e926]: 
              - generic [ref=e929]:
                - generic [ref=e930]:
                  - generic [ref=e931]: 💡
                  - generic [ref=e932]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e934] [cursor=pointer]
                - button "Raw" [ref=e941] [cursor=pointer]
                - button "Delete" [ref=e943] [cursor=pointer]:
                  - generic [ref=e944]: 
              - generic [ref=e947]:
                - generic [ref=e948]:
                  - generic [ref=e949]: 💡
                  - generic [ref=e950]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e952] [cursor=pointer]
                - button "Raw" [ref=e959] [cursor=pointer]
                - button "Delete" [ref=e961] [cursor=pointer]:
                  - generic [ref=e962]: 
              - generic [ref=e965]:
                - generic [ref=e966]:
                  - generic [ref=e967]: 💡
                  - generic [ref=e968]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e970] [cursor=pointer]
                - button "Raw" [ref=e977] [cursor=pointer]
                - button "Delete" [ref=e979] [cursor=pointer]:
                  - generic [ref=e980]: 
              - generic [ref=e983]:
                - generic [ref=e984]:
                  - generic [ref=e985]: 💡
                  - generic [ref=e986]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e988] [cursor=pointer]
                - button "Raw" [ref=e995] [cursor=pointer]
                - button "Delete" [ref=e997] [cursor=pointer]:
                  - generic [ref=e998]: 
              - generic [ref=e1001]:
                - generic [ref=e1002]:
                  - generic [ref=e1003]: 💡
                  - generic [ref=e1004]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1006] [cursor=pointer]
                - button "Raw" [ref=e1013] [cursor=pointer]
                - button "Delete" [ref=e1015] [cursor=pointer]:
                  - generic [ref=e1016]: 
              - generic [ref=e1019]:
                - generic [ref=e1020]:
                  - generic [ref=e1021]: 💡
                  - generic [ref=e1022]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1024] [cursor=pointer]
                - button "Raw" [ref=e1031] [cursor=pointer]
                - button "Delete" [ref=e1033] [cursor=pointer]:
                  - generic [ref=e1034]: 
              - generic [ref=e1037]:
                - generic [ref=e1038]:
                  - generic [ref=e1039]: 💡
                  - generic [ref=e1040]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1042] [cursor=pointer]
                - button "Raw" [ref=e1049] [cursor=pointer]
                - button "Delete" [ref=e1051] [cursor=pointer]:
                  - generic [ref=e1052]: 
              - generic [ref=e1055]:
                - generic [ref=e1056]:
                  - generic [ref=e1057]: 💡
                  - generic [ref=e1058]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1060] [cursor=pointer]
                - button "Raw" [ref=e1067] [cursor=pointer]
                - button "Delete" [ref=e1069] [cursor=pointer]:
                  - generic [ref=e1070]: 
              - generic [ref=e1073]:
                - generic [ref=e1074]:
                  - generic [ref=e1075]: 💡
                  - generic [ref=e1076]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1078] [cursor=pointer]
                - button "Raw" [ref=e1085] [cursor=pointer]
                - button "Delete" [ref=e1087] [cursor=pointer]:
                  - generic [ref=e1088]: 
              - generic [ref=e1091]:
                - generic [ref=e1092]:
                  - generic [ref=e1093]: 💡
                  - generic [ref=e1094]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1096] [cursor=pointer]
                - button "Raw" [ref=e1103] [cursor=pointer]
                - button "Delete" [ref=e1105] [cursor=pointer]:
                  - generic [ref=e1106]: 
              - generic [ref=e1109]:
                - generic [ref=e1110]:
                  - generic [ref=e1111]: 💡
                  - generic [ref=e1112]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1114] [cursor=pointer]
                - button "Raw" [ref=e1121] [cursor=pointer]
                - button "Delete" [ref=e1123] [cursor=pointer]:
                  - generic [ref=e1124]: 
              - generic [ref=e1127]:
                - generic [ref=e1128]:
                  - generic [ref=e1129]: 💡
                  - generic [ref=e1130]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1132] [cursor=pointer]
                - button "Raw" [ref=e1139] [cursor=pointer]
                - button "Delete" [ref=e1141] [cursor=pointer]:
                  - generic [ref=e1142]: 
              - generic [ref=e1145]:
                - generic [ref=e1146]:
                  - generic [ref=e1147]: 💡
                  - generic [ref=e1148]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1150] [cursor=pointer]
                - button "Raw" [ref=e1157] [cursor=pointer]
                - button "Delete" [ref=e1159] [cursor=pointer]:
                  - generic [ref=e1160]: 
              - generic [ref=e1163]:
                - generic [ref=e1164]:
                  - generic [ref=e1165]: 💡
                  - generic [ref=e1166]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1168] [cursor=pointer]
                - button "Raw" [ref=e1175] [cursor=pointer]
                - button "Delete" [ref=e1177] [cursor=pointer]:
                  - generic [ref=e1178]: 
              - generic [ref=e1181]:
                - generic [ref=e1182]:
                  - generic [ref=e1183]: 💡
                  - generic [ref=e1184]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1186] [cursor=pointer]
                - button "Raw" [ref=e1193] [cursor=pointer]
                - button "Delete" [ref=e1195] [cursor=pointer]:
                  - generic [ref=e1196]: 
              - generic [ref=e1199]:
                - generic [ref=e1200]:
                  - generic [ref=e1201]: 💡
                  - generic [ref=e1202]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1204] [cursor=pointer]
                - button "Raw" [ref=e1211] [cursor=pointer]
                - button "Delete" [ref=e1213] [cursor=pointer]:
                  - generic [ref=e1214]: 
              - generic [ref=e1217]:
                - generic [ref=e1218]:
                  - generic [ref=e1219]: 💡
                  - generic [ref=e1220]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1222] [cursor=pointer]
                - button "Raw" [ref=e1229] [cursor=pointer]
                - button "Delete" [ref=e1231] [cursor=pointer]:
                  - generic [ref=e1232]: 
              - generic [ref=e1235]:
                - generic [ref=e1236]:
                  - generic [ref=e1237]: 💡
                  - generic [ref=e1238]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1240] [cursor=pointer]
                - button "Raw" [ref=e1247] [cursor=pointer]
                - button "Delete" [ref=e1249] [cursor=pointer]:
                  - generic [ref=e1250]: 
              - generic [ref=e1253]:
                - generic [ref=e1254]:
                  - generic [ref=e1255]: 💡
                  - generic [ref=e1256]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1258] [cursor=pointer]
                - button "Raw" [ref=e1265] [cursor=pointer]
                - button "Delete" [ref=e1267] [cursor=pointer]:
                  - generic [ref=e1268]: 
              - generic [ref=e1271]:
                - generic [ref=e1272]:
                  - generic [ref=e1273]: 💡
                  - generic [ref=e1274]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1276] [cursor=pointer]
                - button "Raw" [ref=e1283] [cursor=pointer]
                - button "Delete" [ref=e1285] [cursor=pointer]:
                  - generic [ref=e1286]: 
              - generic [ref=e1289]:
                - generic [ref=e1290]:
                  - generic [ref=e1291]: 💡
                  - generic [ref=e1292]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1294] [cursor=pointer]
                - button "Raw" [ref=e1301] [cursor=pointer]
                - button "Delete" [ref=e1303] [cursor=pointer]:
                  - generic [ref=e1304]: 
              - generic [ref=e1307]:
                - generic [ref=e1308]:
                  - generic [ref=e1309]: 💡
                  - generic [ref=e1310]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1312] [cursor=pointer]
                - button "Raw" [ref=e1319] [cursor=pointer]
                - button "Delete" [ref=e1321] [cursor=pointer]:
                  - generic [ref=e1322]: 
              - generic [ref=e1325]:
                - generic [ref=e1326]:
                  - generic [ref=e1327]: 💡
                  - generic [ref=e1328]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1330] [cursor=pointer]
                - button "Raw" [ref=e1337] [cursor=pointer]
                - button "Delete" [ref=e1339] [cursor=pointer]:
                  - generic [ref=e1340]: 
              - generic [ref=e1343]:
                - generic [ref=e1344]:
                  - generic [ref=e1345]: 💡
                  - generic [ref=e1346]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1348] [cursor=pointer]
                - button "Raw" [ref=e1355] [cursor=pointer]
                - button "Delete" [ref=e1357] [cursor=pointer]:
                  - generic [ref=e1358]: 
              - generic [ref=e1361]:
                - generic [ref=e1362]:
                  - generic [ref=e1363]: 💡
                  - generic [ref=e1364]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1366] [cursor=pointer]
                - button "Raw" [ref=e1373] [cursor=pointer]
                - button "Delete" [ref=e1375] [cursor=pointer]:
                  - generic [ref=e1376]: 
              - generic [ref=e1379]:
                - generic [ref=e1380]:
                  - generic [ref=e1381]: 💡
                  - generic [ref=e1382]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1384] [cursor=pointer]
                - button "Raw" [ref=e1391] [cursor=pointer]
                - button "Delete" [ref=e1393] [cursor=pointer]:
                  - generic [ref=e1394]: 
              - generic [ref=e1397]:
                - generic [ref=e1398]:
                  - generic [ref=e1399]: 💡
                  - generic [ref=e1400]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1402] [cursor=pointer]
                - button "Raw" [ref=e1409] [cursor=pointer]
                - button "Delete" [ref=e1411] [cursor=pointer]:
                  - generic [ref=e1412]: 
              - generic [ref=e1415]:
                - generic [ref=e1416]:
                  - generic [ref=e1417]: 💡
                  - generic [ref=e1418]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1420] [cursor=pointer]
                - button "Raw" [ref=e1427] [cursor=pointer]
                - button "Delete" [ref=e1429] [cursor=pointer]:
                  - generic [ref=e1430]: 
              - generic [ref=e1433]:
                - generic [ref=e1434]:
                  - generic [ref=e1435]: 💡
                  - generic [ref=e1436]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1438] [cursor=pointer]
                - button "Raw" [ref=e1445] [cursor=pointer]
                - button "Delete" [ref=e1447] [cursor=pointer]:
                  - generic [ref=e1448]: 
              - generic [ref=e1451]:
                - generic [ref=e1452]:
                  - generic [ref=e1453]: 💡
                  - generic [ref=e1454]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1456] [cursor=pointer]
                - button "Raw" [ref=e1463] [cursor=pointer]
                - button "Delete" [ref=e1465] [cursor=pointer]:
                  - generic [ref=e1466]: 
              - generic [ref=e1469]:
                - generic [ref=e1470]:
                  - generic [ref=e1471]: 💡
                  - generic [ref=e1472]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1474] [cursor=pointer]
                - button "Raw" [ref=e1481] [cursor=pointer]
                - button "Delete" [ref=e1483] [cursor=pointer]:
                  - generic [ref=e1484]: 
              - generic [ref=e1487]:
                - generic [ref=e1488]:
                  - generic [ref=e1489]: 💡
                  - generic [ref=e1490]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1492] [cursor=pointer]
                - button "Raw" [ref=e1499] [cursor=pointer]
                - button "Delete" [ref=e1501] [cursor=pointer]:
                  - generic [ref=e1502]: 
              - generic [ref=e1505]:
                - generic [ref=e1506]:
                  - generic [ref=e1507]: 💡
                  - generic [ref=e1508]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1510] [cursor=pointer]
                - button "Raw" [ref=e1517] [cursor=pointer]
                - button "Delete" [ref=e1519] [cursor=pointer]:
                  - generic [ref=e1520]: 
              - generic [ref=e1523]:
                - generic [ref=e1524]:
                  - generic [ref=e1525]: 💡
                  - generic [ref=e1526]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1528] [cursor=pointer]
                - button "Raw" [ref=e1535] [cursor=pointer]
                - button "Delete" [ref=e1537] [cursor=pointer]:
                  - generic [ref=e1538]: 
              - generic [ref=e1541]:
                - generic [ref=e1542]:
                  - generic [ref=e1543]: 💡
                  - generic [ref=e1544]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1546] [cursor=pointer]
                - button "Raw" [ref=e1553] [cursor=pointer]
                - button "Delete" [ref=e1555] [cursor=pointer]:
                  - generic [ref=e1556]: 
              - generic [ref=e1559]:
                - generic [ref=e1560]:
                  - generic [ref=e1561]: 💡
                  - generic [ref=e1562]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1564] [cursor=pointer]
                - button "Raw" [ref=e1571] [cursor=pointer]
                - button "Delete" [ref=e1573] [cursor=pointer]:
                  - generic [ref=e1574]: 
              - generic [ref=e1577]:
                - generic [ref=e1578]:
                  - generic [ref=e1579]: 💡
                  - generic [ref=e1580]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1582] [cursor=pointer]
                - button "Raw" [ref=e1589] [cursor=pointer]
                - button "Delete" [ref=e1591] [cursor=pointer]:
                  - generic [ref=e1592]: 
              - generic [ref=e1595]:
                - generic [ref=e1596]:
                  - generic [ref=e1597]: 💡
                  - generic [ref=e1598]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1600] [cursor=pointer]
                - button "Raw" [ref=e1607] [cursor=pointer]
                - button "Delete" [ref=e1609] [cursor=pointer]:
                  - generic [ref=e1610]: 
              - generic [ref=e1613]:
                - generic [ref=e1614]:
                  - generic [ref=e1615]: 💡
                  - generic [ref=e1616]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1618] [cursor=pointer]
                - button "Raw" [ref=e1625] [cursor=pointer]
                - button "Delete" [ref=e1627] [cursor=pointer]:
                  - generic [ref=e1628]: 
              - generic [ref=e1631]:
                - generic [ref=e1632]:
                  - generic [ref=e1633]: 💡
                  - generic [ref=e1634]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1636] [cursor=pointer]
                - button "Raw" [ref=e1643] [cursor=pointer]
                - button "Delete" [ref=e1645] [cursor=pointer]:
                  - generic [ref=e1646]: 
              - generic [ref=e1649]:
                - generic [ref=e1650]:
                  - generic [ref=e1651]: 💡
                  - generic [ref=e1652]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1654] [cursor=pointer]
                - button "Raw" [ref=e1661] [cursor=pointer]
                - button "Delete" [ref=e1663] [cursor=pointer]:
                  - generic [ref=e1664]: 
              - generic [ref=e1667]:
                - generic [ref=e1668]:
                  - generic [ref=e1669]: 💡
                  - generic [ref=e1670]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1672] [cursor=pointer]
                - button "Raw" [ref=e1679] [cursor=pointer]
                - button "Delete" [ref=e1681] [cursor=pointer]:
                  - generic [ref=e1682]: 
              - generic [ref=e1685]:
                - generic [ref=e1686]:
                  - generic [ref=e1687]: 💡
                  - generic [ref=e1688]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1690] [cursor=pointer]
                - button "Raw" [ref=e1697] [cursor=pointer]
                - button "Delete" [ref=e1699] [cursor=pointer]:
                  - generic [ref=e1700]: 
              - generic [ref=e1703]:
                - generic [ref=e1704]:
                  - generic [ref=e1705]: 💡
                  - generic [ref=e1706]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1708] [cursor=pointer]
                - button "Raw" [ref=e1715] [cursor=pointer]
                - button "Delete" [ref=e1717] [cursor=pointer]:
                  - generic [ref=e1718]: 
              - generic [ref=e1721]:
                - generic [ref=e1722]:
                  - generic [ref=e1723]: 💡
                  - generic [ref=e1724]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1726] [cursor=pointer]
                - button "Raw" [ref=e1733] [cursor=pointer]
                - button "Delete" [ref=e1735] [cursor=pointer]:
                  - generic [ref=e1736]: 
              - generic [ref=e1739]:
                - generic [ref=e1740]:
                  - generic [ref=e1741]: 💡
                  - generic [ref=e1742]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1744] [cursor=pointer]
                - button "Raw" [ref=e1751] [cursor=pointer]
                - button "Delete" [ref=e1753] [cursor=pointer]:
                  - generic [ref=e1754]: 
              - generic [ref=e1757]:
                - generic [ref=e1758]:
                  - generic [ref=e1759]: 💡
                  - generic [ref=e1760]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1762] [cursor=pointer]
                - button "Raw" [ref=e1769] [cursor=pointer]
                - button "Delete" [ref=e1771] [cursor=pointer]:
                  - generic [ref=e1772]: 
              - generic [ref=e1775]:
                - generic [ref=e1776]:
                  - generic [ref=e1777]: 💡
                  - generic [ref=e1778]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1780] [cursor=pointer]
                - button "Raw" [ref=e1787] [cursor=pointer]
                - button "Delete" [ref=e1789] [cursor=pointer]:
                  - generic [ref=e1790]: 
              - generic [ref=e1793]:
                - generic [ref=e1794]:
                  - generic [ref=e1795]: 💡
                  - generic [ref=e1796]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1798] [cursor=pointer]
                - button "Raw" [ref=e1805] [cursor=pointer]
                - button "Delete" [ref=e1807] [cursor=pointer]:
                  - generic [ref=e1808]: 
              - generic [ref=e1811]:
                - generic [ref=e1812]:
                  - generic [ref=e1813]: 💡
                  - generic [ref=e1814]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1816] [cursor=pointer]
                - button "Raw" [ref=e1823] [cursor=pointer]
                - button "Delete" [ref=e1825] [cursor=pointer]:
                  - generic [ref=e1826]: 
              - generic [ref=e1829]:
                - generic [ref=e1830]:
                  - generic [ref=e1831]: 💡
                  - generic [ref=e1832]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1834] [cursor=pointer]
                - button "Raw" [ref=e1841] [cursor=pointer]
                - button "Delete" [ref=e1843] [cursor=pointer]:
                  - generic [ref=e1844]: 
              - generic [ref=e1847]:
                - generic [ref=e1848]:
                  - generic [ref=e1849]: 💡
                  - generic [ref=e1850]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1852] [cursor=pointer]
                - button "Raw" [ref=e1859] [cursor=pointer]
                - button "Delete" [ref=e1861] [cursor=pointer]:
                  - generic [ref=e1862]: 
              - generic [ref=e1865]:
                - generic [ref=e1866]:
                  - generic [ref=e1867]: 💡
                  - generic [ref=e1868]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1870] [cursor=pointer]
                - button "Raw" [ref=e1877] [cursor=pointer]
                - button "Delete" [ref=e1879] [cursor=pointer]:
                  - generic [ref=e1880]: 
              - generic [ref=e1883]:
                - generic [ref=e1884]:
                  - generic [ref=e1885]: 💡
                  - generic [ref=e1886]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1888] [cursor=pointer]
                - button "Raw" [ref=e1895] [cursor=pointer]
                - button "Delete" [ref=e1897] [cursor=pointer]:
                  - generic [ref=e1898]: 
              - generic [ref=e1901]:
                - generic [ref=e1902]:
                  - generic [ref=e1903]: 💡
                  - generic [ref=e1904]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1906] [cursor=pointer]
                - button "Raw" [ref=e1913] [cursor=pointer]
                - button "Delete" [ref=e1915] [cursor=pointer]:
                  - generic [ref=e1916]: 
              - generic [ref=e1919]:
                - generic [ref=e1920]:
                  - generic [ref=e1921]: 💡
                  - generic [ref=e1922]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1924] [cursor=pointer]
                - button "Raw" [ref=e1931] [cursor=pointer]
                - button "Delete" [ref=e1933] [cursor=pointer]:
                  - generic [ref=e1934]: 
              - generic [ref=e1937]:
                - generic [ref=e1938]:
                  - generic [ref=e1939]: 💡
                  - generic [ref=e1940]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1942] [cursor=pointer]
                - button "Raw" [ref=e1949] [cursor=pointer]
                - button "Delete" [ref=e1951] [cursor=pointer]:
                  - generic [ref=e1952]: 
              - generic [ref=e1955]:
                - generic [ref=e1956]:
                  - generic [ref=e1957]: 💡
                  - generic [ref=e1958]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1960] [cursor=pointer]
                - button "Raw" [ref=e1967] [cursor=pointer]
                - button "Delete" [ref=e1969] [cursor=pointer]:
                  - generic [ref=e1970]: 
              - generic [ref=e1973]:
                - generic [ref=e1974]:
                  - generic [ref=e1975]: 💡
                  - generic [ref=e1976]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1978] [cursor=pointer]
                - button "Raw" [ref=e1985] [cursor=pointer]
                - button "Delete" [ref=e1987] [cursor=pointer]:
                  - generic [ref=e1988]: 
              - generic [ref=e1991]:
                - generic [ref=e1992]:
                  - generic [ref=e1993]: 💡
                  - generic [ref=e1994]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e1996] [cursor=pointer]
                - button "Raw" [ref=e2003] [cursor=pointer]
                - button "Delete" [ref=e2005] [cursor=pointer]:
                  - generic [ref=e2006]: 
              - generic [ref=e2009]:
                - generic [ref=e2010]:
                  - generic [ref=e2011]: 💡
                  - generic [ref=e2012]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2014] [cursor=pointer]
                - button "Raw" [ref=e2021] [cursor=pointer]
                - button "Delete" [ref=e2023] [cursor=pointer]:
                  - generic [ref=e2024]: 
              - generic [ref=e2027]:
                - generic [ref=e2028]:
                  - generic [ref=e2029]: 💡
                  - generic [ref=e2030]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2032] [cursor=pointer]
                - button "Raw" [ref=e2039] [cursor=pointer]
                - button "Delete" [ref=e2041] [cursor=pointer]:
                  - generic [ref=e2042]: 
              - generic [ref=e2045]:
                - generic [ref=e2046]:
                  - generic [ref=e2047]: 💡
                  - generic [ref=e2048]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2050] [cursor=pointer]
                - button "Raw" [ref=e2057] [cursor=pointer]
                - button "Delete" [ref=e2059] [cursor=pointer]:
                  - generic [ref=e2060]: 
              - generic [ref=e2063]:
                - generic [ref=e2064]:
                  - generic [ref=e2065]: 💡
                  - generic [ref=e2066]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2068] [cursor=pointer]
                - button "Raw" [ref=e2075] [cursor=pointer]
                - button "Delete" [ref=e2077] [cursor=pointer]:
                  - generic [ref=e2078]: 
              - generic [ref=e2081]:
                - generic [ref=e2082]:
                  - generic [ref=e2083]: 💡
                  - generic [ref=e2084]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2086] [cursor=pointer]
                - button "Raw" [ref=e2093] [cursor=pointer]
                - button "Delete" [ref=e2095] [cursor=pointer]:
                  - generic [ref=e2096]: 
              - generic [ref=e2099]:
                - generic [ref=e2100]:
                  - generic [ref=e2101]: 💡
                  - generic [ref=e2102]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2104] [cursor=pointer]
                - button "Raw" [ref=e2111] [cursor=pointer]
                - button "Delete" [ref=e2113] [cursor=pointer]:
                  - generic [ref=e2114]: 
              - generic [ref=e2117]:
                - generic [ref=e2118]:
                  - generic [ref=e2119]: 💡
                  - generic [ref=e2120]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2122] [cursor=pointer]
                - button "Raw" [ref=e2129] [cursor=pointer]
                - button "Delete" [ref=e2131] [cursor=pointer]:
                  - generic [ref=e2132]: 
              - generic [ref=e2135]:
                - generic [ref=e2136]:
                  - generic [ref=e2137]: 💡
                  - generic [ref=e2138]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2140] [cursor=pointer]
                - button "Raw" [ref=e2147] [cursor=pointer]
                - button "Delete" [ref=e2149] [cursor=pointer]:
                  - generic [ref=e2150]: 
              - generic [ref=e2153]:
                - generic [ref=e2154]:
                  - generic [ref=e2155]: 💡
                  - generic [ref=e2156]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2158] [cursor=pointer]
                - button "Raw" [ref=e2165] [cursor=pointer]
                - button "Delete" [ref=e2167] [cursor=pointer]:
                  - generic [ref=e2168]: 
              - generic [ref=e2171]:
                - generic [ref=e2172]:
                  - generic [ref=e2173]: 💡
                  - generic [ref=e2174]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2176] [cursor=pointer]
                - button "Raw" [ref=e2183] [cursor=pointer]
                - button "Delete" [ref=e2185] [cursor=pointer]:
                  - generic [ref=e2186]: 
              - generic [ref=e2189]:
                - generic [ref=e2190]:
                  - generic [ref=e2191]: 💡
                  - generic [ref=e2192]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2194] [cursor=pointer]
                - button "Raw" [ref=e2201] [cursor=pointer]
                - button "Delete" [ref=e2203] [cursor=pointer]:
                  - generic [ref=e2204]: 
              - generic [ref=e2207]:
                - generic [ref=e2208]:
                  - generic [ref=e2209]: 💡
                  - generic [ref=e2210]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2212] [cursor=pointer]
                - button "Raw" [ref=e2219] [cursor=pointer]
                - button "Delete" [ref=e2221] [cursor=pointer]:
                  - generic [ref=e2222]: 
              - generic [ref=e2225]:
                - generic [ref=e2226]:
                  - generic [ref=e2227]: 💡
                  - generic [ref=e2228]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2230] [cursor=pointer]
                - button "Raw" [ref=e2237] [cursor=pointer]
                - button "Delete" [ref=e2239] [cursor=pointer]:
                  - generic [ref=e2240]: 
              - generic [ref=e2243]:
                - generic [ref=e2244]:
                  - generic [ref=e2245]: 💡
                  - generic [ref=e2246]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2248] [cursor=pointer]
                - button "Raw" [ref=e2255] [cursor=pointer]
                - button "Delete" [ref=e2257] [cursor=pointer]:
                  - generic [ref=e2258]: 
              - generic [ref=e2261]:
                - generic [ref=e2262]:
                  - generic [ref=e2263]: 💡
                  - generic [ref=e2264]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2266] [cursor=pointer]
                - button "Raw" [ref=e2273] [cursor=pointer]
                - button "Delete" [ref=e2275] [cursor=pointer]:
                  - generic [ref=e2276]: 
              - generic [ref=e2279]:
                - generic [ref=e2280]:
                  - generic [ref=e2281]: 💡
                  - generic [ref=e2282]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2284] [cursor=pointer]
                - button "Raw" [ref=e2291] [cursor=pointer]
                - button "Delete" [ref=e2293] [cursor=pointer]:
                  - generic [ref=e2294]: 
              - generic [ref=e2297]:
                - generic [ref=e2298]:
                  - generic [ref=e2299]: 💡
                  - generic [ref=e2300]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2302] [cursor=pointer]
                - button "Raw" [ref=e2309] [cursor=pointer]
                - button "Delete" [ref=e2311] [cursor=pointer]:
                  - generic [ref=e2312]: 
              - generic [ref=e2315]:
                - generic [ref=e2316]:
                  - generic [ref=e2317]: 💡
                  - generic [ref=e2318]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2320] [cursor=pointer]
                - button "Raw" [ref=e2327] [cursor=pointer]
                - button "Delete" [ref=e2329] [cursor=pointer]:
                  - generic [ref=e2330]: 
              - generic [ref=e2333]:
                - generic [ref=e2334]:
                  - generic [ref=e2335]: 💡
                  - generic [ref=e2336]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2338] [cursor=pointer]
                - button "Raw" [ref=e2345] [cursor=pointer]
                - button "Delete" [ref=e2347] [cursor=pointer]:
                  - generic [ref=e2348]: 
              - generic [ref=e2351]:
                - generic [ref=e2352]:
                  - generic [ref=e2353]: 💡
                  - generic [ref=e2354]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2356] [cursor=pointer]
                - button "Raw" [ref=e2363] [cursor=pointer]
                - button "Delete" [ref=e2365] [cursor=pointer]:
                  - generic [ref=e2366]: 
              - generic [ref=e2369]:
                - generic [ref=e2370]:
                  - generic [ref=e2371]: 💡
                  - generic [ref=e2372]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2374] [cursor=pointer]
                - button "Raw" [ref=e2381] [cursor=pointer]
                - button "Delete" [ref=e2383] [cursor=pointer]:
                  - generic [ref=e2384]: 
              - generic [ref=e2387]:
                - generic [ref=e2388]:
                  - generic [ref=e2389]: 💡
                  - generic [ref=e2390]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2392] [cursor=pointer]
                - button "Raw" [ref=e2399] [cursor=pointer]
                - button "Delete" [ref=e2401] [cursor=pointer]:
                  - generic [ref=e2402]: 
              - generic [ref=e2405]:
                - generic [ref=e2406]:
                  - generic [ref=e2407]: 💡
                  - generic [ref=e2408]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2410] [cursor=pointer]
                - button "Raw" [ref=e2417] [cursor=pointer]
                - button "Delete" [ref=e2419] [cursor=pointer]:
                  - generic [ref=e2420]: 
              - generic [ref=e2423]:
                - generic [ref=e2424]:
                  - generic [ref=e2425]: 💡
                  - generic [ref=e2426]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2428] [cursor=pointer]
                - button "Raw" [ref=e2435] [cursor=pointer]
                - button "Delete" [ref=e2437] [cursor=pointer]:
                  - generic [ref=e2438]: 
              - generic [ref=e2441]:
                - generic [ref=e2442]:
                  - generic [ref=e2443]: 💡
                  - generic [ref=e2444]: Test Idea for Context Menu
                - button "No priority - click for Low" [ref=e2446] [cursor=pointer]
                - button "Raw" [ref=e2453] [cursor=pointer]
                - button "Delete" [ref=e2455] [cursor=pointer]:
                  - generic [ref=e2456]: 
              - generic [ref=e2459]:
                - generic [ref=e2460]:
                  - generic [ref=e2461]: 💡
                  - generic [ref=e2462]: ZZZfull idea
                - button "No priority - click for Low" [ref=e2464] [cursor=pointer]
                - button "Raw" [ref=e2471] [cursor=pointer]
                - button "Delete" [ref=e2473] [cursor=pointer]:
                  - generic [ref=e2474]: 
              - generic [ref=e2477]:
                - generic [ref=e2478]:
                  - generic [ref=e2479]: 💡
                  - generic [ref=e2480]: ZZZfull idea
                - button "No priority - click for Low" [ref=e2482] [cursor=pointer]
                - button "Raw" [ref=e2489] [cursor=pointer]
                - button "Delete" [ref=e2491] [cursor=pointer]:
                  - generic [ref=e2492]: 
              - generic [ref=e2495]:
                - generic [ref=e2496]:
                  - generic [ref=e2497]: 💡
                  - generic [ref=e2498]: ZZZcr2 copy idea
                - button "No priority - click for Low" [ref=e2500] [cursor=pointer]
                - button "Raw" [ref=e2507] [cursor=pointer]
                - button "Delete" [ref=e2509] [cursor=pointer]:
                  - generic [ref=e2510]: 
              - generic [ref=e2513]:
                - generic [ref=e2514]:
                  - generic [ref=e2515]: 💡
                  - generic [ref=e2516]: New Goal Test
                - button "No priority - click for Low" [ref=e2518] [cursor=pointer]
                - button "Raw" [ref=e2525] [cursor=pointer]
                - button "Delete" [ref=e2527] [cursor=pointer]:
                  - generic [ref=e2528]: 
              - generic [ref=e2531]:
                - generic [ref=e2532]:
                  - generic [ref=e2533]: 💡
                  - generic [ref=e2534]: ZZZfull idea
                - button "No priority - click for Low" [ref=e2536] [cursor=pointer]
                - button "Raw" [ref=e2543] [cursor=pointer]
                - button "Delete" [ref=e2545] [cursor=pointer]:
                  - generic [ref=e2546]: 
              - generic [ref=e2549]:
                - generic [ref=e2550]:
                  - generic [ref=e2551]: 💡
                  - generic [ref=e2552]: ZZZfull idea
                - button "No priority - click for Low" [ref=e2554] [cursor=pointer]
                - button "Raw" [ref=e2561] [cursor=pointer]
                - button "Delete" [ref=e2563] [cursor=pointer]:
                  - generic [ref=e2564]: 
              - generic [ref=e2567]:
                - generic [ref=e2568]:
                  - generic [ref=e2569]: 💡
                  - generic [ref=e2570]: ZZZcr2 copy idea
                - button "No priority - click for Low" [ref=e2572] [cursor=pointer]
                - button "Raw" [ref=e2579] [cursor=pointer]
                - button "Delete" [ref=e2581] [cursor=pointer]:
                  - generic [ref=e2582]: 
              - generic [ref=e2585]:
                - generic [ref=e2586]:
                  - generic [ref=e2587]: 💡
                  - generic [ref=e2588]: ZZZfull idea
                - button "No priority - click for Low" [ref=e2590] [cursor=pointer]
                - button "Raw" [ref=e2597] [cursor=pointer]
                - button "Delete" [ref=e2599] [cursor=pointer]:
                  - generic [ref=e2600]: 
              - generic [ref=e2603]:
                - generic [ref=e2604]:
                  - generic [ref=e2605]: 💡
                  - generic [ref=e2606]: ZZZfull idea
                - button "No priority - click for Low" [ref=e2608] [cursor=pointer]
                - button "Raw" [ref=e2615] [cursor=pointer]
                - button "Delete" [ref=e2617] [cursor=pointer]:
                  - generic [ref=e2618]: 
              - generic [ref=e2621]:
                - generic [ref=e2622]:
                  - generic [ref=e2623]: 💡
                  - generic [ref=e2624]: ZZZcr2 copy idea
                - button "No priority - click for Low" [ref=e2626] [cursor=pointer]
                - button "Raw" [ref=e2633] [cursor=pointer]
                - button "Delete" [ref=e2635] [cursor=pointer]:
                  - generic [ref=e2636]: 
              - generic [ref=e2639]:
                - generic [ref=e2640]:
                  - generic [ref=e2641]: 💡
                  - generic [ref=e2642]: ZZZfull idea
                - button "No priority - click for Low" [ref=e2644] [cursor=pointer]
                - button "Raw" [ref=e2651] [cursor=pointer]
                - button "Delete" [ref=e2653] [cursor=pointer]:
                  - generic [ref=e2654]: 
              - generic [ref=e2657]:
                - generic [ref=e2658]:
                  - generic [ref=e2659]: 💡
                  - generic [ref=e2660]: ZZZfull idea
                - button "No priority - click for Low" [ref=e2662] [cursor=pointer]
                - button "Raw" [ref=e2669] [cursor=pointer]
                - button "Delete" [ref=e2671] [cursor=pointer]:
                  - generic [ref=e2672]: 
              - generic [ref=e2675]:
                - generic [ref=e2676]:
                  - generic [ref=e2677]: 💡
                  - generic [ref=e2678]: ZZZprio idea
                - button "No priority - click for Low" [ref=e2680] [cursor=pointer]
                - button "Raw" [ref=e2687] [cursor=pointer]
                - button "Delete" [ref=e2689] [cursor=pointer]:
                  - generic [ref=e2690]: 
              - generic [ref=e2693]:
                - generic [ref=e2694]:
                  - generic [ref=e2695]: 💡
                  - generic [ref=e2696]: ZZZprio editor
                - button "No priority - click for Low" [ref=e2698] [cursor=pointer]
                - button "Raw" [ref=e2705] [cursor=pointer]
                - button "Delete" [ref=e2707] [cursor=pointer]:
                  - generic [ref=e2708]: 
              - generic [ref=e2711]:
                - generic [ref=e2712]:
                  - generic [ref=e2713]: 💡
                  - generic [ref=e2714]: ZZZcr2 copy idea
                - button "No priority - click for Low" [ref=e2716] [cursor=pointer]
                - button "Raw" [ref=e2723] [cursor=pointer]
                - button "Delete" [ref=e2725] [cursor=pointer]:
                  - generic [ref=e2726]: 
              - generic [ref=e2729]:
                - generic [ref=e2730]:
                  - generic [ref=e2731]: 💡
                  - generic [ref=e2732]: ZZZcr2 copy idea
                - button "No priority - click for Low" [ref=e2734] [cursor=pointer]
                - button "Raw" [ref=e2741] [cursor=pointer]
                - button "Delete" [ref=e2743] [cursor=pointer]:
                  - generic [ref=e2744]: 
              - generic [ref=e2747]:
                - generic [ref=e2748]:
                  - generic [ref=e2749]: 💡
                  - generic [ref=e2750]: ZZZfull idea
                - button "No priority - click for Low" [ref=e2752] [cursor=pointer]
                - button "Raw" [ref=e2759] [cursor=pointer]
                - button "Delete" [ref=e2761] [cursor=pointer]:
                  - generic [ref=e2762]: 
              - generic [ref=e2765]:
                - generic [ref=e2766]:
                  - generic [ref=e2767]: 💡
                  - generic [ref=e2768]: ZZZfull idea
                - button "No priority - click for Low" [ref=e2770] [cursor=pointer]
                - button "Raw" [ref=e2777] [cursor=pointer]
                - button "Delete" [ref=e2779] [cursor=pointer]:
                  - generic [ref=e2780]: 
        - text:     
  - contentinfo [ref=e2781]:
    - paragraph [ref=e2783]: © 2026 MyWork. Licensed under the MIT License.
  - text:    
```

# Test source

```ts
  55  |         const titleInput = form.locator('input[name="title"]');
  56  |         await titleInput.fill(`Edit Test ${type.label}`);
  57  |         const saveBtn = page.locator(`#${type.slug}SaveBtn`);
  58  |         await saveBtn.click();
  59  |         await page.waitForLoadState('networkidle');
  60  | 
  61  |         // Now click on the item to edit it
  62  |         const itemRow = page.locator('.entity-row').first();
  63  |         await itemRow.click();
  64  |         const editForm = page.locator('#entity-editor-form');
  65  |         await expect(editForm).toBeVisible();
  66  | 
  67  |         // Change title
  68  |         const titleInputEdit = editForm.locator('input[name="title"]');
  69  |         const currentTitle = await titleInputEdit.inputValue();
  70  |         await titleInputEdit.fill(`${currentTitle} (edited)`);
  71  | 
  72  |         // Save
  73  |         const saveBtnEdit = page.locator(`#${type.slug}SaveBtn`);
  74  |         await saveBtnEdit.click();
  75  |         await page.waitForLoadState('networkidle');
  76  | 
  77  |         // Verify title changed
  78  |         const updatedItemRow = page.locator('.entity-row').first();
  79  |         await expect(updatedItemRow).toContainText('(edited)');
  80  |       });
  81  | 
  82  |       test(`[${type.label}] Toggle close works - click same row again closes editor`, async () => {
  83  |         // Create item
  84  |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  85  |         await addBtn.click();
  86  |         const form = page.locator('#entity-editor-form');
  87  |         await expect(form).toBeVisible();
  88  |         const titleInput = form.locator('input[name="title"]');
  89  |         await titleInput.fill(`Toggle Test ${type.label}`);
  90  |         const saveBtn = page.locator(`#${type.slug}SaveBtn`);
  91  |         await saveBtn.click();
  92  |         await page.waitForLoadState('networkidle');
  93  | 
  94  |         // Click row to open editor
  95  |         const itemRow = page.locator('.entity-row').first();
  96  |         await itemRow.click();
  97  |         const editForm = page.locator('#entity-editor-form');
  98  |         await expect(editForm).toBeVisible();
  99  | 
  100 |         // Click same row again (should close)
  101 |         await itemRow.click();
  102 |         await expect(editForm).not.toBeVisible({ timeout: 2000 });
  103 | 
  104 |         // Click row again (should reopen)
  105 |         await itemRow.click();
  106 |         await expect(editForm).toBeVisible({ timeout: 2000 });
  107 |       });
  108 | 
  109 |       test(`[${type.label}] Can delete an item`, async () => {
  110 |         // Create item
  111 |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  112 |         await addBtn.click();
  113 |         const form = page.locator('#entity-editor-form');
  114 |         await expect(form).toBeVisible();
  115 |         const titleInput = form.locator('input[name="title"]');
  116 |         await titleInput.fill(`Delete Test ${type.label}`);
  117 |         const saveBtn = page.locator(`#${type.slug}SaveBtn`);
  118 |         await saveBtn.click();
  119 |         await page.waitForLoadState('networkidle');
  120 | 
  121 |         // Get initial count
  122 |         const initialRows = await page.locator('.entity-row').count();
  123 | 
  124 |         // Click delete button
  125 |         const deleteBtn = page.locator('[data-action="delete"]').first();
  126 |         page.once('dialog', async dialog => {
  127 |           await dialog.accept();
  128 |         });
  129 |         await deleteBtn.click();
  130 |         await page.waitForLoadState('networkidle');
  131 | 
  132 |         // Verify count decreased
  133 |         const finalRows = await page.locator('.entity-row').count();
  134 |         expect(finalRows).toBeLessThan(initialRows);
  135 |       });
  136 | 
  137 |       test(`[${type.label}] Can create a folder`, async () => {
  138 |         // Click + Folder button
  139 |         const folderBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}FolderBtn`);
  140 |         page.once('dialog', async dialog => {
  141 |           await dialog.type('Test Folder');
  142 |           await dialog.accept();
  143 |         });
  144 |         await folderBtn.click();
  145 |         await page.waitForLoadState('networkidle');
  146 | 
  147 |         // Verify folder appears
  148 |         const folderRow = page.locator('.entity-row').first();
  149 |         await expect(folderRow).toContainText('Test Folder');
  150 |       });
  151 | 
  152 |       test(`[${type.label}] Expand/Collapse buttons work`, async () => {
  153 |         // Create a parent item first
  154 |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
> 155 |         await addBtn.click();
      |                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  156 |         const form = page.locator('#entity-editor-form');
  157 |         await expect(form).toBeVisible();
  158 |         const titleInput = form.locator('input[name="title"]');
  159 |         await titleInput.fill('Parent Item');
  160 |         const saveBtn = page.locator(`#${type.slug}SaveBtn`);
  161 |         await saveBtn.click();
  162 |         await page.waitForLoadState('networkidle');
  163 | 
  164 |         // Check that expand/collapse buttons exist
  165 |         const expandBtn = page.locator(`#expandAll${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  166 |         const collapseBtn = page.locator(`#collapseAll${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  167 |         await expect(expandBtn).toBeVisible();
  168 |         await expect(collapseBtn).toBeVisible();
  169 |       });
  170 | 
  171 |       test(`[${type.label}] Form has title field`, async () => {
  172 |         // Click add button
  173 |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  174 |         await addBtn.click();
  175 | 
  176 |         // Wait for form
  177 |         const form = page.locator('#entity-editor-form');
  178 |         await expect(form).toBeVisible();
  179 | 
  180 |         // Check title field exists
  181 |         const titleField = form.locator('input[name="title"]');
  182 |         await expect(titleField).toBeVisible();
  183 | 
  184 |         // Check label
  185 |         const titleLabel = form.locator('label').first();
  186 |         await expect(titleLabel).toContainText('Title');
  187 |       });
  188 | 
  189 |       test(`[${type.label}] Save button is disabled until changes made`, async () => {
  190 |         // Click add button
  191 |         const addBtn = page.locator(`#add${type.slug.charAt(0).toUpperCase()}${type.slug.slice(1)}Btn`);
  192 |         await addBtn.click();
  193 | 
  194 |         // Wait for form
  195 |         const form = page.locator('#entity-editor-form');
  196 |         await expect(form).toBeVisible();
  197 | 
  198 |         // Check save button is disabled initially
  199 |         const saveBtn = page.locator(`#${type.slug}SaveBtn`);
  200 |         await expect(saveBtn).toBeDisabled();
  201 | 
  202 |         // Make a change
  203 |         const titleInput = form.locator('input[name="title"]');
  204 |         await titleInput.fill('New Item');
  205 | 
  206 |         // Check save button is now enabled
  207 |         await expect(saveBtn).toBeEnabled();
  208 |       });
  209 |     });
  210 |   });
  211 | });
  212 | 
```