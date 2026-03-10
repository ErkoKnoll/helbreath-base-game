# Appearance Sprites/Animations Lookup for Wearable Items on Players

Analysis of how appearance sprites and animations are looked up from .pak files for rendering wearable items on players, based on **EPos** (Equipment Position) and **ApprV** (Appearance Value) combinations. Derived from Client.cpp, Server.cpp, Item.cfg, Item2.cfg, and Item3.cfg.

---

## 0. Item Pack Lookup Logic (Sprite Sheet & Index)

Items are displayed in three contexts. Each uses **Spr** (m_sSprite) and **SFrame** (m_sSpriteFrame) from the item config, but the lookup differs:

### 0.1 Inventory (Bag) — item-pack.pak


| Input            | Output                                | Client.cpp                                             |
| ---------------- | ------------------------------------- | ------------------------------------------------------ |
| **Sprite index** | `DEF_SPRID_ITEMPACK_PIVOTPOINT + Spr` | `m_pSprite[DEF_SPRID_ITEMPACK_PIVOTPOINT + m_sSprite]` |
| **Frame**        | `SFrame`                              | `PutSpriteFast(..., m_sSpriteFrame, ...)`              |


**Sprite sheet:** `Spr` selects which pre-loaded sprite object to use. `MakeSprite("item-pack", DEF_SPRID_ITEMPACK_PIVOTPOINT+1, 27, FALSE)` loads 27 sheets at indices 1–27, so **Spr 1 → item-pack sheet 0**, **Spr 6 → sheet 5**, **Spr 16 → sheet 15** (necks). Spr 20–22 explicitly load item-pack sheets 17–19 (Angels pendants).

### 0.2 On Ground — item-ground.pak


| Input            | Output                                            | Client.cpp                                    |
| ---------------- | ------------------------------------------------- | --------------------------------------------- |
| **Sprite index** | `DEF_SPRID_ITEMGROUND_PIVOTPOINT + m_sItemSprite` | (m_sItemSprite = Spr from item config)        |
| **Frame**        | `m_sItemSpriteFrame` (= SFrame)                   | `PutSpriteFast(..., m_sItemSpriteFrame, ...)` |


Same Spr→sheet mapping as item-pack: Spr 1 → item-ground sheet 0, etc. Only 19 base sheets + 20–22 for Angels.

### 0.3 Paperdoll (Equipped Preview) — item-equipM.pak / item-equipW.pak / item-pack.pak


| Input            | Output                                 | Client.cpp                                                                    |
| ---------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| **Sprite index** | `DEF_SPRID_ITEMEQUIP_PIVOTPOINT + Spr` | `m_pSprite[DEF_SPRID_ITEMEQUIP_PIVOTPOINT + sSprH]` where `sSprH = m_sSprite` |
| **Frame**        | `SFrame`                               | `PutSpriteFast(..., sFrame, ...)`                                             |


**Sprite sheet:** Spr maps to a pre-loaded slot. Male and female use different base offsets (0–22 for male, 40–62 for female). See **section 4.12** for the full Spr → .pak sheet mapping. Spr 16 and 22 use **item-pack.pak** sheets 15 and 19; all others use **item-equipM** or **item-equipW**.

### 0.4 In-World Character (Equipped on Player)

For other players, the client uses **ApprV** from the appearance packet, not Spr/SFrame. ApprV is packed per EPos into sAppr1–sAppr4. The sprite index is computed by slot-specific formulas (e.g. `DEF_SPRID_WEAPON_M + ApprV*64 + frame`). See sections 2–4.

**Summary:** Spr selects the sprite object (and thus the sheet); SFrame selects the frame within that sheet. For inventory/ground/paperdoll, use Spr and SFrame. For in-world appearance, use ApprV and EPos.

---

## 1. Item Config Format

Item config columns (parsed by Client.cpp and Server.cpp):


| Col | Field  | Description                                                                     |
| --- | ------ | ------------------------------------------------------------------------------- |
| 14  | Spr    | m_sSprite — selects sheet in item-pack/item-ground/item-equip                   |
| 15  | SFrame | m_sSpriteFrame — frame index within sheet                                       |
| 18  | ApprV  | m_cApprValue — **appearance variant** for equipped items (animation/sprite set) |


**EPos** (Equipment Position) comes from the item's Type/equip slot. Server maps EPos to `DEF_EQUIPPOS_`* and packs `m_cApprValue` into the appearance packet (`sAppr1`, `sAppr2`, `sAppr3`, `sAppr4`).

---

## 2. Appearance Packet Bit Layout (Server → Client)

The server encodes equipped item ApprV values into 4 words sent to other clients:


| Word       | Bits  | EPos / Slot            | Client Usage                              |
| ---------- | ----- | ---------------------- | ----------------------------------------- |
| **sAppr1** | 0–3   | Undies (skin)          | `DEF_SPRID_UNDIES_* + (val)*15 + iAdd`    |
| **sAppr1** | 8–11  | Hair                   | `DEF_SPRID_HAIR_* + (val)*15 + iAdd`      |
| **sAppr2** | 0–3   | Shield (LHand)         | `DEF_SPRID_SHIELD_* + (val)*8 + 4`        |
| **sAppr2** | 4–11  | Weapon (RHand/TwoHand) | `DEF_SPRID_WEAPON_* + (val)*64 + frame`   |
| **sAppr3** | 0–3   | Arms (berk)            | `DEF_SPRID_BERK_* + (val)*15 + iAdd`      |
| **sAppr3** | 4–7   | Head (helm)            | `DEF_SPRID_HEAD_* + (val)*15 + iAdd`      |
| **sAppr3** | 8–11  | Pants (leggings)       | `DEF_SPRID_LEGG_* + (val)*15 + iAdd`      |
| **sAppr3** | 12–15 | Body (armor)           | `DEF_SPRID_BODYARMOR_* + (val)*15 + iAdd` |
| **sAppr4** | 8–11  | Back (cape)            | `DEF_SPRID_MANTLE_* + (val)*15 + iAdd`    |
| **sAppr4** | 12–15 | Boots (foot)           | `DEF_SPRID_BOOT_* + (val)*15 + iAdd`      |


---

## 3. EPos → Equip Slot Mapping


| EPos | Slot           | Server DEF_EQUIPPOS     | Spr (item-equip)         |
| ---- | -------------- | ----------------------- | ------------------------ |
| 1    | Head           | DEF_EQUIPPOS_HEAD       | 21 (helm)                |
| 2    | Body           | DEF_EQUIPPOS_BODY       | 9 (M) / 13 (W)           |
| 3    | Arms           | DEF_EQUIPPOS_ARMS       | 7 (M) / 11 (W)           |
| 4    | Leggings       | DEF_EQUIPPOS_LEGGINGS   | 8 (M) / 12 (W)           |
| 5    | Foot           | (boots)                 | 5                        |
| 6    | Neck           | —                       | 16 (item-pack sheet 15)  |
| 7    | Shield (LHand) | DEF_EQUIPPOS_LHAND      | 3                        |
| 8    | RHand          | DEF_EQUIPPOS_RHAND      | 1 (swords)               |
| 9    | TwoHand        | DEF_EQUIPPOS_TWOHAND    | 2 (bows) / 1 (2H swords) |
| 10   | Ring           | —                       | (no visual)              |
| 12   | Back (cape)    | DEF_EQUIPPOS_BACK       | 20                       |
| 13   | Full costume   | DEF_EQUIPPOS_RELEASEALL | (body+all)               |


---

## 4. Sprite/Pak Ranges by EPos and ApprV

### 4.1 WEAPONS (EPos 8 RHand, 9 TwoHand, 10 TwoHand)

**Pak files:** `Msw.pak`, `Msw2.pak`, `Msw3.pak`, `MStormBringer.pak`, `MDarkExec.pak`, `MKlonessBlade.pak`, `MKlonessAstock.pak`, `MDebastator.pak`, `MAxe1-6.pak`, `MPickAxe1.pak`, `Mhoe.pak`, `MKlonessAxe.pak`, `MLightBlade.pak`, `MHammer.pak`, `MBHammer.pak`, `MBabHammer.pak`, `MBShadowSword.pak`, `MBerserkWand.pak`, `Mstaff1-3.pak`, `MReMagicWand.pak`, `MKlonessWand.pak`, `Mbo.pak`, `MDirectBow.pak`, `MFireBow.pak`

**Male (M):**


| ApprV | .pak File                                          | Sheet Range (0-based) | Frames per Variant |
| ----- | -------------------------------------------------- | --------------------- | ------------------ |
| 1–4   | Msw.pak                                            | 0–3 (sheets 0–3)      | 56                 |
| 5     | Mswx.pak                                           | 0                     | 56                 |
| 6–12  | Msw.pak                                            | 5–11 (sheets 5–11)    | 56                 |
| 13    | Msw2.pak                                           | 0                     | 56                 |
| 14    | Msw3.pak                                           | 0                     | 56                 |
| 15    | MStormBringer.pak                                  | 0                     | 56                 |
| 16    | MDarkExec.pak                                      | 0                     | 56                 |
| 17    | MKlonessBlade.pak                                  | 0                     | 56                 |
| 18    | MKlonessAstock.pak                                 | 0                     | 56                 |
| 19    | MDebastator.pak                                    | 0                     | 56                 |
| 20–26 | MAxe1–6, MPickAxe1, Mhoe, MKlonessAxe, MLightBlade | 0                     | 56 each            |
| 27–29 | (MAxe6, Mhoe, MKlonessAxe)                         | —                     | —                  |
| 30–33 | MHammer, MBHammer, MBabHammer, MBShadowSword       | 0                     | 56 each            |
| 34    | MBerserkWand.pak                                   | 0                     | 56                 |
| 35–39 | Mstaff1–3, MReMagicWand, MKlonessWand              | 0                     | 56 each            |
| 40    | Mbo.pak                                            | 0                     | 56                 |
| 41    | Mbo.pak                                            | 56–111 (sheet 1)      | 56                 |
| 42    | MDirectBow.pak                                     | 0                     | 56                 |
| 43    | MFireBow.pak                                       | 0                     | 56                 |


**Client index:** `DEF_SPRID_WEAPON_M + ApprV*64 + frame` (frame = 8*4 + (dir-1) for idle, etc.)

**Female (W):** Same structure with `Wsw.pak`, `Wsw2.pak`, `Wsw3.pak`, `WStormBringer.pak`, etc., and `DEF_SPRID_WEAPON_W`.

---

### 4.2 SHIELDS (EPos 7 LHand)

**Pak file:** `Msh.pak` (male), `Wsh.pak` (female)


| ApprV | .pak File | Sheet Range (0-based) | Frames |
| ----- | --------- | --------------------- | ------ |
| 1     | Msh.pak   | 0–6                   | 7      |
| 2     | Msh.pak   | 7–13                  | 7      |
| 3     | Msh.pak   | 14–20                 | 7      |
| 4     | Msh.pak   | 21–27                 | 7      |
| 5     | Msh.pak   | 28–34                 | 7      |
| 6     | Msh.pak   | 35–41                 | 7      |
| 7     | Msh.pak   | 42–48                 | 7      |
| 8     | Msh.pak   | 49–55                 | 7      |
| 9     | Msh.pak   | 56–62                 | 7      |


**Client index:** `DEF_SPRID_SHIELD_M + ApprV*8 + 4` (frame 4 = idle)

---

### 4.3 CAPES (EPos 12 Back)

**Pak files:** `Mmantle01.pak`–`Mmantle06.pak` (male), `Wmantle01.pak`–`Wmantle06.pak` (female)


| ApprV | .pak File (M) | .pak File (W) | Frames |
| ----- | ------------- | ------------- | ------ |
| 1     | Mmantle01.pak | Wmantle01.pak | 12     |
| 2     | Mmantle02.pak | Wmantle02.pak | 12     |
| 3     | Mmantle03.pak | Wmantle03.pak | 12     |
| 4     | Mmantle04.pak | Wmantle04.pak | 12     |
| 5     | Mmantle05.pak | Wmantle05.pak | 12     |
| 6     | Mmantle06.pak | Wmantle06.pak | 12     |


**Client index:** `DEF_SPRID_MANTLE_* + ApprV*15 + iAdd`

---

### 4.4 HEAD / HELMETS (EPos 1)

**Pak files:** `MHelm1-4.pak`, `MHCap1-2.pak`, `MHHelm1-2.pak`, `NMHelm1-4.pak` (male); `WHelm1.pak`, `WHelm4.pak`, `WHHelm1-2.pak`, `WHCap1-2.pak`, `NWHelm1-4.pak` (female)


| ApprV | .pak File (M) | .pak File (W) | Frames |
| ----- | ------------- | ------------- | ------ |
| 1     | MHelm1.pak    | WHelm1.pak    | 12     |
| 2     | MHelm2.pak    | —             | 12     |
| 3     | MHelm3.pak    | —             | 12     |
| 4     | MHelm4.pak    | WHelm4.pak    | 12     |
| 5     | NMHelm1.pak   | NWHelm1.pak   | 12     |
| 6     | NMHelm2.pak   | NWHelm2.pak   | 12     |
| 7     | NMHelm3.pak   | NWHelm3.pak   | 12     |
| 8     | NMHelm4.pak   | NWHelm4.pak   | 12     |
| 9     | MHHelm1.pak   | WHHelm1.pak   | 12     |
| 10    | MHHelm2.pak   | WHHelm2.pak   | 12     |
| 11    | MHCap1.pak    | WHCap1.pak    | 12     |
| 12    | MHCap2.pak    | WHCap2.pak    | 12     |


**Client index:** `DEF_SPRID_HEAD_* + ApprV*15 + iAdd`

---

### 4.5 BODY ARMOR (EPos 2)

**Pak files:** `MLArmor.pak`, `MCMail.pak`, `MSMail.pak`, `MPMail.pak`, `Mtunic.pak`, `MRobe1.pak`, `MSanta.pak`, `MHPMail1-2.pak`, `MHRobe1-2.pak` (male); `WBodice1-2.pak`, `WLArmor.pak`, `WCMail.pak`, `WSMail.pak`, `WPMail.pak`, `WRobe1.pak`, `WSanta.pak`, `WHPMail1-2.pak`, `WHRobe1-2.pak` (female)


| ApprV | .pak File (M) | .pak File (W) | Frames |
| ----- | ------------- | ------------- | ------ |
| 1     | MLArmor.pak   | WBodice1.pak  | 12     |
| 2     | MCMail.pak    | WBodice2.pak  | 12     |
| 3     | MSMail.pak    | WLArmor.pak   | 12     |
| 4     | MPMail.pak    | WCMail.pak    | 12     |
| 5     | Mtunic.pak    | WSMail.pak    | 12     |
| 6     | MRobe1.pak    | WPMail.pak    | 12     |
| 7     | MSanta.pak    | WRobe1.pak    | 12     |
| 8     | MHPMail1.pak  | WHPMail1.pak  | 12     |
| 9     | MHPMail2.pak  | WHPMail2.pak  | 12     |
| 10    | MHRobe1.pak   | WHRobe1.pak   | 12     |
| 11    | MHRobe2.pak   | WHRobe2.pak   | 12     |


**Client index:** `DEF_SPRID_BODYARMOR_* + ApprV*15 + iAdd`

---

### 4.6 ARMS / BERK (EPos 3)

**Pak files:** `MShirt.pak`, `MHauberk.pak`, `MHHauberk1-2.pak` (male); `WChemiss.pak`, `WShirt.pak`, `WHauberk.pak`, `WHHauberk1-2.pak` (female)


| ApprV | .pak File (M)  | .pak File (W)  | Frames |
| ----- | -------------- | -------------- | ------ |
| 1     | MShirt.pak     | WChemiss.pak   | 12     |
| 2     | MHauberk.pak   | WShirt.pak     | 12     |
| 3     | MHHauberk1.pak | WHauberk.pak   | 12     |
| 4     | MHHauberk2.pak | WHHauberk1.pak | 12     |
| 6     | —              | WHHauberk2.pak | 12     |


**Client index:** `DEF_SPRID_BERK_* + ApprV*15 + iAdd`

---

### 4.7 LEGGINGS / PANTS (EPos 4)

**Pak files:** `MTrouser.pak`, `MHTrouser.pak`, `MCHoses.pak`, `MLeggings.pak`, `MHLeggings1-2.pak` (male); `WSkirt.pak`, `WTrouser.pak`, `WHTrouser.pak`, `WCHoses.pak`, `WLeggings.pak`, `WHLeggings1-2.pak` (female)


| ApprV | .pak File (M)   | .pak File (W)   | Frames |
| ----- | --------------- | --------------- | ------ |
| 1     | MTrouser.pak    | WSkirt.pak      | 12     |
| 2     | MHTrouser.pak   | WTrouser.pak    | 12     |
| 3     | MCHoses.pak     | WHTrouser.pak   | 12     |
| 4     | MLeggings.pak   | WCHoses.pak     | 12     |
| 5     | MHLeggings1.pak | WLeggings.pak   | 12     |
| 6     | MHLeggings2.pak | WHLeggings1.pak | 12     |
| 7     | —               | WHLeggings2.pak | 12     |


**Client index:** `DEF_SPRID_LEGG_* + ApprV*15 + iAdd`

---

### 4.8 BOOTS / FOOT (EPos 5)

**Pak files:** `MShoes.pak`, `MLBoots.pak` (male); `WShoes.pak`, `WLBoots.pak` (female)


| ApprV | .pak File (M) | .pak File (W) | Frames |
| ----- | ------------- | ------------- | ------ |
| 1     | MShoes.pak    | WShoes.pak    | 12     |
| 2     | MLBoots.pak   | WLBoots.pak   | 12     |


**Client index:** `DEF_SPRID_BOOT_* + ApprV*15 + iAdd`

---

### 4.9 UNDIES / SKIN (character creation)

**Pak files:** `Mpt.pak` (male), `Wpt.pak` (female)


| ApprV | .pak File         | Sheet Range (0-based) | Frames         |
| ----- | ----------------- | --------------------- | -------------- |
| 0–7   | Mpt.pak / Wpt.pak | val*12 to val*12+11   | 12 per variant |


**Client index:** `DEF_SPRID_UNDIES_* + ApprV*15 + iAdd`

---

### 4.10 HAIR (character creation)

**Pak files:** `Mhr.pak` (male), `Whr.pak` (female)


| ApprV | .pak File         | Sheet Range (0-based) | Frames         |
| ----- | ----------------- | --------------------- | -------------- |
| 0–7   | Mhr.pak / Whr.pak | val*12 to val*12+11   | 12 per variant |


**Client index:** `DEF_SPRID_HAIR_* + ApprV*15 + iAdd`

---

### 4.11 NECKLACES (EPos 6)

**Pak file:** `item-pack.pak` (sheet 15)

- **Paperdoll:** `DEF_SPRID_ITEMEQUIP_PIVOTPOINT + 16` (male) or `+ 56` (female)
- **Frame:** `m_sSpriteFrame` from item config
- **Angels pendants (Spr 22):** `item-pack.pak` sheet 19

---

### 4.12 ITEM-EQUIP (Paperdoll / Inventory Preview)

**Pak files:** `item-equipM.pak`, `item-equipW.pak`, `item-pack.pak`


| Spr | item-equipM sheet | item-equipW sheet | Slot             |
| --- | ----------------- | ----------------- | ---------------- |
| 1   | 1                 | 1                 | Swords           |
| 2   | 2                 | 2                 | Bows             |
| 3   | 3                 | 3                 | Shields          |
| 4   | 4                 | 4                 | Tunics           |
| 5   | 5                 | 5                 | Shoes            |
| 7   | 6                 | 6                 | Berk (arms)      |
| 8   | 7                 | 7                 | Hoses (leggings) |
| 9   | 8                 | 8                 | Body armor       |
| 11  | 6                 | 6                 | Female berk      |
| 12  | 7                 | 7                 | Female hose      |
| 13  | 8                 | 8                 | Female body      |
| 15  | 11                | 11                | Axe/hammer       |
| 16  | item-pack 15      | item-pack 15      | Necklaces        |
| 17  | 12                | 12                | Wands            |
| 20  | 13                | 13                | Capes            |
| 21  | 14                | 14                | Helm             |
| 22  | item-pack 19      | item-pack 19      | Angels pendants  |


**Frame:** `m_sSpriteFrame` from item config. **ApprV** is used for the in-world animation sprites above, not for the paperdoll.

---

## 5. Summary: All Sprite/Pak Ranges by EPos+ApprV


| EPos | Slot     | .pak Files                                                                      | ApprV Range | Sprite Index Formula            |
| ---- | -------- | ------------------------------------------------------------------------------- | ----------- | ------------------------------- |
| 1    | Head     | MHelm*, MHCap*, MHHelm*, NMHelm* / W*                                           | 1–12        | HEAD_* + ApprV*15 + iAdd        |
| 2    | Body     | MLArmor, MCMail, MSMail, MPMail, Mtunic, MRobe1, MSanta, MHPMail*, MHRobe* / W* | 1–11        | BODYARMOR_* + ApprV*15 + iAdd   |
| 3    | Arms     | MShirt, MHauberk, MHHauberk* / W*                                               | 1–6         | BERK_* + ApprV*15 + iAdd        |
| 4    | Leggings | MTrouser, MHTrouser, MCHoses, MLeggings, MHLeggings* / W*                       | 1–7         | LEGG_* + ApprV*15 + iAdd        |
| 5    | Foot     | MShoes, MLBoots / W*                                                            | 1–2         | BOOT_* + ApprV*15 + iAdd        |
| 6    | Neck     | item-pack.pak sheet 15                                                          | —           | ITEMEQUIP + 16/56, frame=SFrame |
| 7    | Shield   | Msh.pak / Wsh.pak                                                               | 1–9         | SHIELD_* + ApprV*8 + 4          |
| 8    | RHand    | Msw*, MAxe*, MHammer*, Mstaff*, Mbo, etc. / W*                                  | 1–43        | WEAPON_* + ApprV*64 + frame     |
| 9    | TwoHand  | (same as RHand)                                                                 | 1–43        | WEAPON_* + ApprV*64 + frame     |
| 10   | TwoHand  | (same as RHand)                                                                 | 1–43        | WEAPON_* + ApprV*64 + frame     |
| 12   | Cape     | Mmantle01–06 / Wmantle01–06                                                     | 1–6         | MANTLE_* + ApprV*15 + iAdd      |


---

## 6. Item Reference Table

All items from Item.cfg, Item2.cfg, and Item3.cfg (568 items). Columns: ID, Name, Type, EPos, Spr, SFrame, Price, Wgt, ApprV, Speed, Skill, Cat.


| ID   | Name                 | Type | EPos | Spr | SFrame | Price    | Wgt   | ApprV | Speed | Skill | Cat |
| ---- | -------------------- | ---- | ---- | --- | ------ | -------- | ----- | ----- | ----- | ----- | --- |
| 1    | Dagger               | 1    | 8    | 1   | 0      | 25       | 200   | 1     | 0     | 1     | 0   |
| 2    | Dagger(S.C)          | 1    | 8    | 1   | 0      | -55      | 200   | 1     | 0     | 1     | 0   |
| 3    | Dagger(Swd.breaker)  | 1    | 8    | 1   | 0      | -55      | 200   | 1     | 0     | 1     | 0   |
| 4    | Dagger+1             | 1    | 8    | 1   | 0      | 100      | 200   | 1     | 0     | 1     | 0   |
| 6    | KightDagger          | 1    | 8    | 1   | 0      | -35      | 200   | 1     | 0     | 1     | 0   |
| 7    | Dirk                 | 1    | 8    | 1   | 0      | -35      | 200   | 1     | 0     | 1     | 0   |
| 8    | ShortSword           | 1    | 8    | 1   | 1      | 50       | 800   | 2     | 2     | 1     | 0   |
| 9    | ShortSword+1         | 1    | 8    | 1   | 1      | 200      | 800   | 2     | 2     | 1     | 0   |
| 11   | ShortSword(S.C)      | 1    | 8    | 1   | 1      | -100     | 800   | 2     | 2     | 1     | 0   |
| 12   | MainGauche           | 1    | 8    | 1   | 1      | 50       | 800   | 2     | 2     | 1     | 0   |
| 13   | MainGauche+1         | 1    | 8    | 1   | 1      | 200      | 800   | 2     | 2     | 1     | 0   |
| 14   | MainGauche(S.C)      | 1    | 8    | 1   | 1      | -100     | 800   | 2     | 2     | 1     | 0   |
| 15   | Gradius              | 1    | 8    | 1   | 1      | 90       | 800   | 2     | 2     | 1     | 0   |
| 16   | Gradius+1            | 1    | 8    | 1   | 1      | 350      | 800   | 2     | 2     | 1     | 0   |
| 17   | LongSword            | 1    | 8    | 1   | 2      | 180      | 1400  | 3     | 6     | 1     | 0   |
| 18   | LongSword+1          | 1    | 8    | 1   | 2      | 650      | 1400  | 3     | 6     | 1     | 0   |
| 19   | LongSword+2          | 1    | 8    | 1   | 2      | -2600    | 1600  | 3     | 6     | 1     | 0   |
| 20   | Excaliber            | 1    | 8    | 1   | 19     | -31000   | 4000  | 5     | 0     | 1     | 0   |
| 22   | LongSword(S.C)       | 1    | 8    | 1   | 2      | -250     | 1400  | 3     | 6     | 1     | 0   |
| 23   | Sabre                | 1    | 8    | 1   | 3      | 150      | 1200  | 4     | 5     | 1     | 0   |
| 24   | Sabre+1              | 1    | 8    | 1   | 3      | 600      | 1200  | 4     | 5     | 1     | 0   |
| 25   | Scimitar             | 1    | 8    | 1   | 4      | 200      | 1800  | 6     | 6     | 1     | 0   |
| 26   | Scimitar+1           | 1    | 8    | 1   | 4      | 800      | 1800  | 6     | 6     | 1     | 0   |
| 27   | Scimitar+2           | 1    | 8    | 1   | 4      | -3200    | 2000  | 6     | 6     | 1     | 0   |
| 28   | Falchion             | 1    | 8    | 1   | 5      | 250      | 2200  | 6     | 6     | 1     | 0   |
| 29   | Falchion+1           | 1    | 8    | 1   | 5      | 1000     | 2200  | 6     | 6     | 1     | 0   |
| 30   | Falchion+2           | 1    | 8    | 1   | 5      | -4000    | 2200  | 6     | 6     | 1     | 0   |
| 31   | Esterk               | 1    | 8    | 1   | 6      | 400      | 1200  | 7     | 4     | 1     | 0   |
| 32   | Esterk+1             | 1    | 8    | 1   | 6      | 800      | 1200  | 7     | 4     | 1     | 0   |
| 33   | Esterk+2             | 1    | 8    | 1   | 6      | -3200    | 1200  | 7     | 4     | 1     | 0   |
| 34   | Rapier               | 1    | 8    | 1   | 6      | 300      | 1100  | 7     | 3     | 1     | 0   |
| 35   | Rapier+1             | 1    | 8    | 1   | 6      | 1300     | 1100  | 7     | 3     | 1     | 0   |
| 36   | Rapier+2             | 1    | 8    | 1   | 6      | -5200    | 1100  | 7     | 3     | 1     | 0   |
| 37   | TemplerSword         | 1    | 8    | 1   | 6      | -1000    | 1200  | 7     | 5     | 1     | 0   |
| 38   | BroadSword           | 1    | 9    | 1   | 7      | 250      | 2800  | 8     | 6     | 1     | 0   |
| 39   | BroadSword+1         | 1    | 9    | 1   | 7      | 1100     | 2800  | 8     | 6     | 1     | 0   |
| 40   | BroadSword+2         | 1    | 9    | 1   | 7      | -4400    | 2800  | 8     | 6     | 1     | 0   |
| 41   | BroadSword(S.C)      | 1    | 9    | 1   | 7      | -400     | 2800  | 8     | 6     | 1     | 0   |
| 42   | BastadSword          | 1    | 9    | 1   | 8      | 300      | 3300  | 9     | 6     | 1     | 0   |
| 43   | BastadSword+1        | 1    | 9    | 1   | 8      | 1200     | 3300  | 9     | 6     | 1     | 0   |
| 44   | BastadSword+2        | 1    | 9    | 1   | 8      | -4800    | 3300  | 9     | 6     | 1     | 0   |
| 45   | BastadSword(S.C)     | 1    | 9    | 1   | 8      | -450     | 3300  | 9     | 6     | 1     | 0   |
| 46   | Claymore             | 1    | 9    | 1   | 9      | 400      | 4000  | 10    | 7     | 1     | 0   |
| 47   | Claymore+1           | 1    | 9    | 1   | 9      | 1800     | 4000  | 10    | 7     | 1     | 0   |
| 48   | Claymore+2           | 1    | 9    | 1   | 9      | -7200    | 4000  | 10    | 7     | 1     | 0   |
| 49   | Claymore(S.C)        | 1    | 9    | 1   | 9      | -600     | 4000  | 10    | 7     | 1     | 0   |
| 50   | GreatSword           | 1    | 9    | 1   | 10     | 500      | 5200  | 11    | 8     | 1     | 0   |
| 51   | GreatSword+1         | 1    | 9    | 1   | 10     | 2300     | 5200  | 11    | 8     | 1     | 0   |
| 52   | GreatSword+2         | 1    | 9    | 1   | 10     | -9200    | 5200  | 11    | 8     | 1     | 0   |
| 53   | GreatSword(S.C)      | 1    | 9    | 1   | 10     | -700     | 5200  | 11    | 8     | 1     | 0   |
| 54   | Flameberge           | 1    | 9    | 1   | 11     | 700      | 6000  | 12    | 10    | 1     | 0   |
| 55   | Flameberge+1         | 1    | 9    | 1   | 11     | 3300     | 6000  | 12    | 10    | 1     | 0   |
| 56   | Flameberge+2         | 1    | 9    | 1   | 11     | -13200   | 6000  | 12    | 10    | 1     | 0   |
| 57   | Flameberge(S.C)      | 1    | 9    | 1   | 11     | -1000    | 6000  | 12    | 10    | 1     | 0   |
| 59   | LightAxe             | 1    | 8    | 15  | 2      | 100      | 1400  | 22    | 3     | 1     | 0   |
| 60   | LightAxe+1           | 1    | 8    | 15  | 2      | 350      | 1400  | 22    | 3     | 1     | 0   |
| 61   | LightAxe+2           | 1    | 8    | 15  | 2      | -1400    | 1400  | 22    | 3     | 1     | 0   |
| 62   | Tomahoc              | 1    | 8    | 15  | 2      | 180      | 1700  | 22    | 4     | 1     | 0   |
| 63   | Tomahoc+1            | 1    | 8    | 15  | 2      | 700      | 1700  | 22    | 4     | 1     | 0   |
| 64   | Tomahoc+2            | 1    | 8    | 15  | 2      | -2800    | 1700  | 22    | 4     | 1     | 0   |
| 65   | SexonAxe             | 1    | 8    | 15  | 3      | 200      | 2000  | 23    | 4     | 1     | 0   |
| 66   | SexonAxe+1           | 1    | 8    | 15  | 3      | 800      | 2000  | 23    | 4     | 1     | 0   |
| 67   | SexonAxe+2           | 1    | 8    | 15  | 3      | -3200    | 2000  | 23    | 4     | 1     | 0   |
| 68   | DoubleAxe            | 1    | 8    | 15  | 0      | 560      | 3300  | 20    | 5     | 1     | 0   |
| 69   | DoubleAxe+1          | 1    | 8    | 15  | 0      | 1200     | 3300  | 20    | 5     | 1     | 0   |
| 70   | DoubleAxe+2          | 1    | 8    | 15  | 0      | -4800    | 3300  | 20    | 5     | 1     | 0   |
| 71   | WarAxe               | 1    | 8    | 15  | 1      | 700      | 4400  | 21    | 8     | 1     | 0   |
| 72   | WarAxe+1             | 1    | 8    | 15  | 1      | 2000     | 4400  | 21    | 8     | 1     | 0   |
| 73   | WarAxe+2             | 1    | 8    | 15  | 1      | -8000    | 4400  | 21    | 8     | 1     | 0   |
| 74   | 4BladeGoldenAxe      | 1    | 8    | 15  | 4      | -52000   | 2000  | 24    | 6     | 1     | 0   |
| 75   | ShortBow             | 1    | 9    | 2   | 0      | 100      | 800   | 40    | 4     | 3     | 0   |
| 76   | LongBow              | 1    | 9    | 2   | 1      | 200      | 1200  | 41    | 5     | 3     | 0   |
| 77   | Arrow                | 6    | 0    | 6   | 10     | 1        | 10    | 1     | 3     | 4     | 0   |
| 78   | PoisonArrow          | 6    | 0    | 6   | 10     | -5       | 10    | 1     | 5     | 4     | 0   |
| 79   | WoodShield           | 1    | 7    | 3   | 0      | 100      | 800   | 1     | 0     | 5     | 0   |
| 80   | LeatherShield        | 1    | 7    | 3   | 1      | 150      | 1000  | 2     | 0     | 5     | 0   |
| 81   | TargeShield          | 1    | 7    | 3   | 2      | 250      | 1800  | 3     | 0     | 5     | 0   |
| 82   | ScootermShield       | 1    | 7    | 3   | 3      | 300      | 2000  | 4     | 0     | 5     | 0   |
| 83   | BlondeShield         | 1    | 7    | 3   | 4      | 450      | 2000  | 5     | 0     | 5     | 0   |
| 84   | IronShield           | 1    | 7    | 3   | 5      | 700      | 2500  | 6     | 0     | 5     | 0   |
| 85   | LagiShield           | 1    | 7    | 3   | 6      | 1300     | 3000  | 7     | 0     | 5     | 0   |
| 86   | KnightShield         | 1    | 7    | 3   | 7      | 1500     | 3200  | 8     | 0     | 5     | 0   |
| 87   | TowerShield          | 1    | 7    | 3   | 8      | 1800     | 4000  | 9     | 0     | 5     | 0   |
| 88   | GuildAdmissionTicket | 0    | 0    | 6   | 9      | 5        | 1     | -1    | 0     | 42    | 0   |
| 89   | GuildSecessionTicket | 0    | 0    | 6   | 9      | 5        | 1     | -1    | 0     | 42    | 0   |
| 90   | Gold                 | 5    | 0    | 6   | 0      | 1        | 1     | -1    | 0     | 42    | 0   |
| 91   | RedPotion            | 7    | 0    | 6   | 1      | 10       | 30    | -1    | 0     | 21    | 0   |
| 92   | BigRedPotion         | 7    | 0    | 6   | 2      | 65       | 100   | -1    | 0     | 21    | 0   |
| 93   | BluePotion           | 7    | 0    | 6   | 3      | 10       | 30    | -1    | 0     | 21    | 0   |
| 94   | BigBluePotion        | 7    | 0    | 6   | 4      | 65       | 100   | -1    | 0     | 21    | 0   |
| 95   | GreenPotion          | 7    | 0    | 6   | 5      | 10       | 30    | -1    | 0     | 21    | 0   |
| 96   | BigGreenPotion       | 7    | 0    | 6   | 6      | 65       | 100   | -1    | 0     | 21    | 0   |
| 97   | DilutionPotion       | 3    | 0    | 6   | 5      | 200      | 30    | -1    | 0     | 42    | 0   |
| 98   | Baguette             | 7    | 0    | 6   | 8      | 5        | 17    | -1    | 0     | 31    | 0   |
| 99   | Meat                 | 7    | 0    | 6   | 7      | 10       | 52    | -1    | 0     | 31    | 0   |
| 100  | Fish                 | 7    | 0    | 6   | 11     | 30       | 30    | -1    | 0     | 31    | 0   |
| 101  | RedFish              | 7    | 0    | 6   | 14     | -400     | 100   | -1    | 0     | 31    | 0   |
| 102  | GreenFish            | 7    | 0    | 6   | 15     | -200     | 100   | -1    | 0     | 31    | 0   |
| 103  | YellowFish           | 7    | 0    | 6   | 16     | -100     | 100   | -1    | 0     | 31    | 0   |
| 104  | Map                  | 9    | 0    | 6   | 9      | 30       | 1     | -1    | 0     | 42    | 0   |
| 105  | FishingRod           | 8    | 0    | 14  | 0      | 100      | 300   | -1    | 0     | 43    | 0   |
| 106  | PretendCorpseManual  | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 107  | ArcheryManual        | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 108  | ShieldManual         | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 109  | LongSwordManual      | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 110  | FencingManual        | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 111  | FishingManual        | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 112  | AxeManual            | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 113  | MagicResistManual    | 3    | 0    | 6   | 92     | 500      | 1     | -1    | 0     | 42    | 0   |
| 114  | RecallScroll         | 3    | 0    | 6   | 9      | 120      | 1     | -1    | 0     | 42    | 0   |
| 115  | InvisibilityScroll   | 3    | 0    | 6   | 9      | 560      | 1     | -1    | 0     | 42    | 0   |
| 116  | DetectInviScroll     | 3    | 0    | 6   | 9      | 330      | 1     | -1    | 0     | 42    | 0   |
| 117  | BleedingIslandTicket | 3    | 0    | 6   | 9      | 100      | 1     | -1    | 0     | 42    | 0   |
| 188  | SnakeMeat            | 7    | 0    | 6   | 17     | -57      | 45    | 1     | 0     | 31    | 0   |
| 189  | SnakeSkin            | 5    | 0    | 6   | 18     | -175     | 20    | 1     | 0     | 31    | 0   |
| 190  | SnakeTeeth           | 5    | 0    | 6   | 19     | -55      | 5     | 1     | 0     | 31    | 0   |
| 191  | SnakeTongue          | 5    | 0    | 6   | 20     | -50      | 3     | 1     | 0     | 31    | 0   |
| 192  | AntLeg               | 5    | 0    | 6   | 21     | -32      | 17    | 1     | 0     | 31    | 0   |
| 193  | AntFeeler            | 5    | 0    | 6   | 22     | -34      | 10    | 1     | 0     | 31    | 0   |
| 194  | CyclopsEye           | 0    | 0    | 6   | 23     | -170     | 330   | 1     | 0     | 31    | 0   |
| 195  | CyclopsHandEdge      | 0    | 0    | 6   | 24     | -270     | 4000  | 1     | 0     | 31    | 0   |
| 196  | CyclopsHeart         | 0    | 0    | 6   | 25     | -160     | 1230  | 1     | 0     | 31    | 0   |
| 197  | CyclopsMeat          | 7    | 0    | 6   | 26     | -90      | 500   | 1     | 0     | 31    | 0   |
| 198  | CyclopsLeather       | 5    | 0    | 6   | 27     | -600     | 350   | 1     | 0     | 31    | 0   |
| 199  | HelboundHeart        | 0    | 0    | 6   | 28     | -90      | 820   | 1     | 0     | 31    | 0   |
| 200  | HelboundLeather      | 5    | 0    | 6   | 29     | -320     | 200   | 1     | 0     | 31    | 0   |
| 201  | HelboundTail         | 5    | 0    | 6   | 30     | -70      | 250   | 1     | 0     | 31    | 0   |
| 202  | HelboundTeeth        | 5    | 0    | 6   | 31     | -70      | 130   | 1     | 0     | 31    | 0   |
| 203  | HelboundClaw         | 5    | 0    | 6   | 32     | -70      | 280   | 1     | 0     | 31    | 0   |
| 204  | HelboundTongue       | 5    | 0    | 6   | 33     | -75      | 150   | 1     | 0     | 31    | 0   |
| 205  | LumpofClay           | 5    | 0    | 6   | 34     | -95      | 230   | 1     | 0     | 31    | 0   |
| 206  | OrcMeat              | 7    | 0    | 6   | 35     | -50      | 100   | 1     | 0     | 31    | 0   |
| 207  | OrcLeather           | 5    | 0    | 6   | 36     | -193     | 100   | 1     | 0     | 31    | 0   |
| 208  | OrcTeeth             | 5    | 0    | 6   | 37     | -56      | 50    | 1     | 0     | 31    | 0   |
| 209  | OgreHair             | 5    | 0    | 6   | 38     | -230     | 250   | 1     | 0     | 31    | 0   |
| 210  | OgreHeart            | 0    | 0    | 6   | 39     | -340     | 1580  | 1     | 0     | 31    | 0   |
| 211  | OgreMeat             | 7    | 0    | 6   | 40     | -200     | 710   | 1     | 0     | 31    | 0   |
| 212  | OgreLeather          | 5    | 0    | 6   | 41     | -840     | 650   | 1     | 0     | 31    | 0   |
| 213  | OgreTeeth            | 5    | 0    | 6   | 42     | -215     | 230   | 1     | 0     | 31    | 0   |
| 214  | OgreClaw             | 5    | 0    | 6   | 43     | -215     | 370   | 1     | 0     | 31    | 0   |
| 215  | ScorpionPincers      | 0    | 0    | 6   | 44     | -50      | 1200  | 1     | 0     | 31    | 0   |
| 216  | ScorpionMeat         | 7    | 0    | 6   | 45     | -55      | 450   | 1     | 0     | 31    | 0   |
| 217  | ScorpionSting        | 0    | 0    | 6   | 46     | -55      | 1000  | 1     | 0     | 31    | 0   |
| 218  | ScorpionSkin         | 5    | 0    | 6   | 47     | -90      | 380   | 1     | 0     | 31    | 0   |
| 219  | SkeletonBones        | 5    | 0    | 6   | 48     | -50      | 1300  | 1     | 0     | 31    | 0   |
| 220  | SlimeJelly           | 5    | 0    | 6   | 49     | -10      | 100   | 1     | 0     | 31    | 0   |
| 221  | StoneGolemPiece      | 5    | 0    | 6   | 50     | -50      | 500   | 1     | 0     | 31    | 0   |
| 222  | TrollHeart           | 0    | 0    | 6   | 51     | -145     | 1050  | 1     | 0     | 31    | 0   |
| 223  | TrollMeat            | 7    | 0    | 6   | 52     | -180     | 500   | 1     | 0     | 31    | 0   |
| 224  | TrollLeather         | 5    | 0    | 6   | 53     | -335     | 450   | 1     | 0     | 31    | 0   |
| 225  | TrollClaw            | 5    | 0    | 6   | 54     | -70      | 290   | 1     | 0     | 31    | 0   |
| 226  | AlchemyManual        | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 227  | AlchemyBowl          | 10   | 0    | 6   | 55     | 1000     | 700   | -1    | 0     | 21    | 0   |
| 230  | MiningManual         | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 231  | PickAxe              | 1    | 8    | 15  | 5      | 500      | 1000  | 25    | 10    | 1     | 0   |
| 232  | Hoe                  | 1    | 8    | 15  | 9      | 300      | 1000  | 27    | 5     | 1     | 0   |
| 235  | ManufacturingManual  | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 236  | ManufacturingHammer  | 10   | 0    | 6   | 113    | 1500     | 2000  | -1    | 0     | 21    | 0   |
| 237  | HammerAttackManual   | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 245  | AresdenFlag(Master)  | 11   | 0    | 6   | 56     | -100     | 1     | -1    | 0     | 42    | 0   |
| 246  | ElvineFlag(Master)   | 11   | 0    | 6   | 57     | -100     | 1     | -1    | 0     | 42    | 0   |
| 247  | AresdenFlag          | 11   | 0    | 6   | 56     | -100     | 1     | -1    | 0     | 42    | 0   |
| 248  | ElvineFlag           | 11   | 0    | 6   | 57     | -100     | 1     | -1    | 0     | 42    | 0   |
| 250  | WandAttackManual     | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 256  | MagicWand(MS20)      | 1    | 8    | 17  | 1      | 5000     | 1000  | 36    | 3     | 8     | 0   |
| 257  | MagicWand(MS10)      | 1    | 8    | 17  | 1      | 2500     | 1000  | 36    | 3     | 8     | 0   |
| 258  | MagicWand(MS0)       | 1    | 8    | 17  | 1      | 1000     | 1000  | 36    | 3     | 8     | 0   |
| 259  | MagicWand(M.Shield)  | 1    | 8    | 17  | 1      | -8200    | 1000  | 36    | 3     | 8     | 0   |
| 270  | HairColorPotion      | 7    | 0    | 6   | 5      | -300     | 100   | -1    | 0     | 21    | 0   |
| 271  | HairStylePotion      | 7    | 0    | 6   | 5      | -400     | 100   | -1    | 0     | 21    | 0   |
| 272  | SkinColorPotion      | 7    | 0    | 6   | 5      | -500     | 100   | -1    | 0     | 21    | 0   |
| 273  | InvisibilityPotion   | 7    | 0    | 6   | 5      | -700     | 100   | -1    | 0     | 21    | 0   |
| 274  | SexChangePotion      | 7    | 0    | 6   | 5      | -4000    | 100   | -1    | 0     | 21    | 0   |
| 275  | OgrePotion           | 7    | 0    | 6   | 5      | -5000    | 100   | -1    | 0     | 21    | 0   |
| 276  | UnderWearPotion      | 7    | 0    | 6   | 5      | -4000    | 100   | -1    | 0     | 21    | 0   |
| 290  | Flameberge+3(LLF)    | 1    | 9    | 1   | 11     | -21000   | 6000  | 12    | 10    | 1     | 0   |
| 291  | MagicWand(MS30-LLF)  | 1    | 8    | 17  | 0      | -10000   | 1000  | 35    | 3     | 8     | 0   |
| 292  | GoldenAxe(LLF)       | 1    | 8    | 15  | 4      | -32000   | 2000  | 24    | 6     | 1     | 0   |
| 300  | MagicNecklace(RM10)  | 1    | 6    | 16  | 4      | -2250    | 400   | -1    | 0     | 46    | 0   |
| 305  | MagicNecklace(DM+1)  | 1    | 6    | 16  | 5      | -39800   | 400   | -1    | 0     | 46    | 0   |
| 308  | MagicNecklace(MS10)  | 1    | 6    | 16  | 7      | -7000    | 400   | -1    | 0     | 46    | 0   |
| 311  | MagicNecklace(DF+10) | 1    | 6    | 16  | 6      | -19000   | 400   | -1    | 0     | 46    | 0   |
| 315  | GoldNecklace         | 1    | 6    | 16  | 8      | 1000     | 300   | -1    | 0     | 46    | 0   |
| 316  | SilverNecklace       | 1    | 6    | 16  | 9      | 500      | 300   | -1    | 0     | 46    | 0   |
| 331  | GoldRing             | 1    | 10   | 16  | 14     | 700      | 200   | -1    | 0     | 46    | 0   |
| 332  | SilverRing           | 1    | 10   | 16  | 15     | 350      | 200   | -1    | 0     | 46    | 0   |
| 333  | PlatinumRing         | 1    | 10   | 16  | 15     | -750     | 200   | -1    | 0     | 46    | 0   |
| 334  | LuckyGoldRing        | 1    | 10   | 16  | 13     | -2750    | 200   | -1    | 0     | 46    | 0   |
| 335  | EmeraldRing          | 1    | 10   | 16  | 10     | -2500    | 200   | -1    | 0     | 46    | 0   |
| 336  | SapphireRing         | 1    | 10   | 16  | 11     | -2450    | 200   | -1    | 0     | 46    | 0   |
| 337  | RubyRing             | 1    | 10   | 16  | 12     | -1800    | 200   | -1    | 0     | 46    | 0   |
| 338  | MemorialRing         | 1    | 10   | 16  | 12     | -1000    | 200   | -1    | 0     | 46    | 0   |
| 350  | Diamond              | 5    | 0    | 16  | 42     | -3000    | 200   | 1     | 0     | 46    | 0   |
| 351  | Ruby                 | 5    | 0    | 16  | 43     | -2000    | 200   | 1     | 0     | 46    | 0   |
| 352  | Sapphire             | 5    | 0    | 16  | 44     | -2000    | 200   | 1     | 0     | 46    | 0   |
| 353  | Emerald              | 5    | 0    | 16  | 45     | -2000    | 200   | 1     | 0     | 46    | 0   |
| 354  | GoldNugget           | 5    | 0    | 16  | 21     | -300     | 300   | 1     | 0     | 46    | 0   |
| 355  | Coal                 | 5    | 0    | 16  | 22     | -50      | 180   | 1     | 0     | 46    | 0   |
| 356  | SilverNugget         | 5    | 0    | 16  | 23     | -200     | 220   | 1     | 0     | 46    | 0   |
| 357  | IronOre              | 5    | 0    | 16  | 24     | -100     | 250   | 1     | 0     | 46    | 0   |
| 358  | Crystal              | 5    | 0    | 16  | 46     | -300     | 200   | 1     | 0     | 46    | 0   |
| 360  | Dye(Indigo)          | 11   | 0    | 6   | 58     | 100      | 1     | -1    | 0     | 42    | 0   |
| 361  | Dye(Crimson-Red)     | 11   | 0    | 6   | 58     | -100     | 1     | -1    | 0     | 42    | 0   |
| 362  | Dye(Brown)           | 11   | 0    | 6   | 58     | -100     | 1     | -1    | 0     | 42    | 0   |
| 363  | Dye(Gold)            | 11   | 0    | 6   | 58     | -100     | 1     | -1    | 0     | 42    | 0   |
| 364  | Dye(Green)           | 11   | 0    | 6   | 62     | 100      | 1     | -1    | 0     | 42    | 0   |
| 365  | Dye(Gray)            | 11   | 0    | 6   | 63     | 100      | 1     | -1    | 0     | 42    | 0   |
| 366  | Dye(Aqua)            | 11   | 0    | 6   | 58     | 100      | 1     | -1    | 0     | 42    | 0   |
| 367  | Dye(Pink)            | 11   | 0    | 6   | 58     | -100     | 1     | -1    | 0     | 42    | 0   |
| 368  | Dye(Violet)          | 11   | 0    | 6   | 66     | 100      | 1     | -1    | 0     | 42    | 0   |
| 369  | Dye(Blue)            | 11   | 0    | 6   | 67     | 100      | 1     | -1    | 0     | 42    | 0   |
| 370  | Dye(Tan)             | 11   | 0    | 6   | 68     | 100      | 1     | -1    | 0     | 42    | 0   |
| 371  | Dye(Khaki)           | 11   | 0    | 6   | 69     | 100      | 1     | -1    | 0     | 42    | 0   |
| 372  | Dye(Yellow)          | 11   | 0    | 6   | 70     | 100      | 1     | -1    | 0     | 42    | 0   |
| 373  | Dye(Red)             | 11   | 0    | 6   | 71     | 100      | 1     | -1    | 0     | 42    | 0   |
| 374  | Dye(Black)           | 11   | 0    | 6   | 58     | -100     | 1     | -1    | 0     | 42    | 0   |
| 375  | DecolorationPotion   | 11   | 0    | 6   | 58     | 100      | 1     | -1    | 0     | 42    | 0   |
| 380  | IceStormManual       | 3    | 0    | 6   | 91     | -100     | 1     | -1    | 0     | 42    | 1   |
| 381  | MassFireStrikeManual | 3    | 0    | 6   | 91     | -100     | 1     | -1    | 0     | 42    | 2   |
| 382  | BloodyShockW.Manual  | 3    | 0    | 6   | 91     | -100     | 1     | -1    | 0     | 42    | 2   |
| 385  | HandAttackManual     | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 386  | ShortSwordManual     | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 390  | PowerGreenPotion     | 7    | 0    | 6   | 5      | -600     | 30    | -1    | 0     | 21    | 0   |
| 391  | SuperGreenPotion     | 7    | 0    | 6   | 5      | -1200    | 30    | -1    | 0     | 21    | 0   |
| 400  | AresdenHeroCape      | 1    | 12   | 20  | 0      | -2000    | 200   | 1     | 0     | 13    | 0   |
| 401  | ElvineHeroCape       | 1    | 12   | 20  | 1      | -2000    | 200   | 2     | 0     | 13    | 0   |
| 402  | Cape                 | 1    | 12   | 20  | 2      | 1000     | 200   | 3     | 0     | 12    | 0   |
| 403  | aHeroHelm(M)         | 1    | 1    | 21  | 7      | -16000   | 10000 | 10    | 0     | 6     | 0   |
| 404  | aHeroHelm(W)         | 1    | 1    | 21  | 7      | -16000   | 10000 | 10    | 0     | 6     | 0   |
| 405  | eHeroHelm(M)         | 1    | 1    | 21  | 6      | -16000   | 10000 | 9     | 0     | 6     | 0   |
| 406  | eHeroHelm(W)         | 1    | 1    | 21  | 6      | -16000   | 10000 | 9     | 0     | 6     | 0   |
| 407  | aHeroCap(M)          | 1    | 1    | 21  | 9      | -12000   | 1500  | 12    | 0     | 6     | 0   |
| 408  | aHeroCap(W)          | 1    | 1    | 21  | 9      | -12000   | 1500  | 12    | 0     | 6     | 0   |
| 409  | eHeroCap(M)          | 1    | 1    | 21  | 8      | -12000   | 1500  | 11    | 0     | 6     | 0   |
| 410  | eHeroCap(W)          | 1    | 1    | 21  | 8      | -12000   | 1500  | 11    | 0     | 6     | 0   |
| 411  | aHeroArmor(M)        | 1    | 2    | 9   | 8      | -40000   | 10000 | 9     | 0     | 6     | 0   |
| 412  | aHeroArmor(W)        | 1    | 2    | 13  | 9      | -40000   | 10000 | 10    | 0     | 6     | 0   |
| 413  | eHeroArmor(M)        | 1    | 2    | 9   | 7      | -40000   | 10000 | 8     | 0     | 6     | 0   |
| 414  | eHeroArmor(W)        | 1    | 2    | 13  | 8      | -40000   | 10000 | 9     | 0     | 6     | 0   |
| 415  | aHeroRobe(M)         | 1    | 2    | 9   | 10     | -30000   | 1500  | 11    | 0     | 13    | 0   |
| 416  | aHeroRobe(W)         | 1    | 2    | 13  | 11     | -30000   | 1500  | 12    | 0     | 13    | 0   |
| 417  | eHeroRobe(M)         | 1    | 2    | 9   | 9      | -30000   | 1500  | 10    | 0     | 13    | 0   |
| 418  | eHeroRobe(W)         | 1    | 2    | 13  | 10     | -30000   | 1500  | 11    | 0     | 13    | 0   |
| 419  | aHeroHauberk(M)      | 1    | 3    | 7   | 3      | -14000   | 1500  | 4     | 0     | 6     | 0   |
| 420  | aHeroHauberk(W)      | 1    | 3    | 11  | 4      | -14000   | 1500  | 5     | 0     | 6     | 0   |
| 421  | eHeroHauberk(M)      | 1    | 3    | 7   | 2      | -14000   | 1500  | 3     | 0     | 6     | 0   |
| 422  | eHeroHauberk(W)      | 1    | 3    | 11  | 3      | -14000   | 1500  | 4     | 0     | 6     | 0   |
| 423  | aHeroLeggings(M)     | 1    | 4    | 8   | 5      | -22000   | 1500  | 6     | 0     | 6     | 0   |
| 424  | aHeroLeggings(W)     | 1    | 4    | 12  | 6      | -22000   | 1500  | 7     | 0     | 6     | 0   |
| 425  | eHeroLeggings(M)     | 1    | 4    | 8   | 4      | -22000   | 1500  | 5     | 0     | 6     | 0   |
| 426  | eHeroLeggings(W)     | 1    | 4    | 12  | 5      | -22000   | 1500  | 6     | 0     | 6     | 0   |
| 427  | AresdenHeroCape+1    | 1    | 12   | 20  | 3      | -2000    | 200   | 4     | 0     | 13    | 0   |
| 428  | ElvineHeroCape+1     | 1    | 12   | 20  | 4      | -2000    | 200   | 5     | 0     | 13    | 0   |
| 429  | Cape+1               | 1    | 12   | 20  | 5      | 1000     | 200   | 6     | 0     | 12    | 0   |
| 450  | Shoes                | 1    | 5    | 5   | 0      | 20       | 200   | 1     | 0     | 12    | 0   |
| 451  | LongBoots            | 1    | 5    | 5   | 1      | 100      | 500   | 2     | 0     | 12    | 0   |
| 453  | Shirt(M)             | 1    | 3    | 7   | 0      | 20       | 100   | 1     | 0     | 11    | 0   |
| 454  | Hauberk(M)           | 1    | 3    | 7   | 1      | 400      | 1200  | 2     | 0     | 6     | 0   |
| 455  | LeatherArmor(M)      | 1    | 2    | 9   | 0      | 500      | 1500  | 1     | 0     | 6     | 0   |
| 456  | ChainMail(M)         | 1    | 2    | 9   | 1      | 1200     | 3000  | 2     | 0     | 6     | 0   |
| 457  | ScaleMail(M)         | 1    | 2    | 9   | 2      | 900      | 2000  | 3     | 0     | 6     | 0   |
| 458  | PlateMail(M)         | 1    | 2    | 9   | 3      | 4500     | 10000 | 4     | 0     | 6     | 0   |
| 459  | Trousers(M)          | 1    | 4    | 8   | 0      | 80       | 100   | 1     | 0     | 11    | 0   |
| 460  | KneeTrousers(M)      | 1    | 4    | 8   | 1      | 20       | 100   | 2     | 0     | 11    | 0   |
| 461  | ChainHose(M)         | 1    | 4    | 8   | 2      | 400      | 1000  | 3     | 0     | 6     | 0   |
| 462  | PlateLeggings(M)     | 1    | 4    | 8   | 3      | 1000     | 2000  | 4     | 0     | 6     | 0   |
| 470  | Chemise(W)           | 1    | 3    | 11  | 0      | 200      | 100   | 1     | 0     | 11    | 0   |
| 471  | Shirt(W)             | 1    | 3    | 11  | 1      | 20       | 100   | 2     | 0     | 11    | 0   |
| 472  | Hauberk(W)           | 1    | 3    | 11  | 2      | 400      | 1200  | 3     | 0     | 6     | 0   |
| 473  | Bodice(W)            | 1    | 2    | 13  | 0      | 150      | 200   | 1     | 0     | 11    | 0   |
| 474  | LongBodice(W)        | 1    | 2    | 13  | 1      | 180      | 200   | 2     | 0     | 11    | 0   |
| 475  | LeatherArmor(W)      | 1    | 2    | 13  | 2      | 500      | 1500  | 3     | 0     | 6     | 0   |
| 476  | ChainMail(W)         | 1    | 2    | 13  | 3      | 1200     | 3000  | 4     | 0     | 6     | 0   |
| 477  | ScaleMail(W)         | 1    | 2    | 13  | 4      | 900      | 2000  | 5     | 0     | 6     | 0   |
| 478  | PlateMail(W)         | 1    | 2    | 13  | 5      | 4500     | 10000 | 6     | 0     | 6     | 0   |
| 479  | Skirt(W)             | 1    | 4    | 12  | 0      | 200      | 100   | 1     | 0     | 11    | 0   |
| 480  | Trousers(W)          | 1    | 4    | 12  | 1      | 80       | 100   | 2     | 0     | 11    | 0   |
| 481  | KneeTrousers(W)      | 1    | 4    | 12  | 2      | 20       | 100   | 3     | 0     | 11    | 0   |
| 482  | ChainHose(W)         | 1    | 4    | 12  | 3      | 400      | 1000  | 4     | 0     | 6     | 0   |
| 483  | PlateLeggings(W)     | 1    | 4    | 12  | 4      | 1000     | 2000  | 5     | 0     | 6     | 0   |
| 484  | Tunic(M)             | 1    | 2    | 9   | 4      | 350      | 500   | 5     | 0     | 11    | 0   |
| 490  | BloodSword           | 1    | 9    | 1   | 7      | -31000   | 13100 | 8     | 11    | 1     | 9   |
| 491  | BloodAxe             | 1    | 8    | 15  | 1      | -25000   | 6100  | 21    | 8     | 1     | 9   |
| 492  | BloodRapier          | 1    | 8    | 1   | 6      | -25000   | 1100  | 7     | 3     | 1     | 9   |
| 500  | IronIngot            | 12   | 0    | 6   | 76     | -500     | 500   | 1     | 0     | 46    | 0   |
| 501  | SuperCoal            | 12   | 0    | 6   | 88     | -200     | 500   | 1     | 0     | 46    | 0   |
| 502  | UltraCoal            | 12   | 0    | 6   | 88     | -500     | 500   | 1     | 0     | 46    | 0   |
| 503  | GoldIngot            | 12   | 0    | 6   | 74     | -3000    | 500   | 1     | 0     | 46    | 0   |
| 504  | SilverIngot          | 12   | 0    | 6   | 75     | -2000    | 500   | 1     | 0     | 46    | 0   |
| 505  | BlondeIngot          | 12   | 0    | 6   | 77     | -1000    | 500   | 1     | 0     | 46    | 0   |
| 506  | MithralIngot         | 12   | 0    | 6   | 78     | -6000    | 800   | 1     | 0     | 46    | 0   |
| 507  | BlondeStone          | 5    | 0    | 6   | 79     | -160     | 180   | 1     | 0     | 46    | 0   |
| 508  | Mithral              | 5    | 0    | 6   | 80     | -50      | 180   | 1     | 0     | 46    | 0   |
| 511  | ArenaTicket          | 3    | 0    | 6   | 89     | -100     | 1     | -1    | 0     | 42    | 0   |
| 513  | ArenaTicket(2)       | 3    | 0    | 6   | 89     | -100     | 1     | -1    | 0     | 42    | 0   |
| 515  | ArenaTicket(3)       | 3    | 0    | 6   | 89     | -100     | 1     | -1    | 0     | 42    | 0   |
| 517  | ArenaTicket(4)       | 3    | 0    | 6   | 89     | -100     | 1     | -1    | 0     | 42    | 0   |
| 520  | Bouquette            | 0    | 0    | 6   | 81     | 1000     | 180   | 1     | 0     | 46    | 0   |
| 521  | FlowerBasket         | 0    | 0    | 6   | 82     | 1500     | 180   | 1     | 0     | 46    | 0   |
| 522  | Flowerpot            | 0    | 0    | 6   | 83     | 500      | 180   | 1     | 0     | 46    | 0   |
| 530  | ArenaTicket(5)       | 3    | 0    | 6   | 89     | -10      | 1     | -1    | 0     | 42    | 0   |
| 531  | ArenaTicket(6)       | 3    | 0    | 6   | 89     | -10      | 1     | -1    | 0     | 42    | 0   |
| 532  | ArenaTicket(7)       | 3    | 0    | 6   | 89     | -10      | 1     | -1    | 0     | 42    | 0   |
| 533  | ArenaTicket(8)       | 3    | 0    | 6   | 89     | -10      | 1     | -1    | 0     | 42    | 0   |
| 534  | ArenaTicket(9)       | 3    | 0    | 6   | 89     | -10      | 1     | -1    | 0     | 42    | 0   |
| 540  | DemonEye             | 0    | 0    | 6   | 93     | -3000    | 530   | 1     | 0     | 31    | 0   |
| 541  | DemonHeart           | 0    | 0    | 6   | 94     | -5000    | 1500  | 1     | 0     | 31    | 0   |
| 542  | DemonMeat            | 7    | 0    | 6   | 95     | -2000    | 1200  | 1     | 0     | 31    | 0   |
| 543  | DemonLeather         | 5    | 0    | 6   | 96     | -6000    | 900   | 1     | 0     | 31    | 0   |
| 544  | UnicornHeart         | 0    | 0    | 6   | 97     | -5000    | 230   | 1     | 0     | 31    | 0   |
| 545  | UnicornHorn          | 0    | 0    | 6   | 98     | -50000   | 250   | 1     | 0     | 31    | 0   |
| 546  | UnicornMeat          | 7    | 0    | 6   | 99     | -2000    | 500   | 1     | 0     | 31    | 0   |
| 547  | UnicornLeather       | 5    | 0    | 6   | 100    | -6000    | 650   | 1     | 0     | 31    | 0   |
| 548  | WerewolfHeart        | 0    | 0    | 6   | 101    | -210     | 350   | 1     | 0     | 31    | 0   |
| 549  | WerewolfNail         | 5    | 0    | 6   | 102    | -140     | 290   | 1     | 0     | 31    | 0   |
| 550  | WerewolfMeat         | 7    | 0    | 6   | 103    | -250     | 500   | 1     | 0     | 31    | 0   |
| 551  | WerewolfTail         | 0    | 0    | 6   | 104    | -300     | 550   | 1     | 0     | 31    | 0   |
| 552  | WerewolfTeeth        | 5    | 0    | 6   | 105    | -140     | 290   | 1     | 0     | 31    | 0   |
| 553  | WerewolfLeather      | 5    | 0    | 6   | 106    | -820     | 450   | 1     | 0     | 31    | 0   |
| 554  | WerewolfClaw         | 5    | 0    | 6   | 107    | -140     | 290   | 1     | 0     | 31    | 0   |
| 560  | BattleAxe            | 1    | 9    | 15  | 6      | 3500     | 9000  | 26    | 13    | 1     | 0   |
| 570  | RedCarp              | 7    | 0    | 6   | 14     | -1200    | 100   | -1    | 0     | 31    | 0   |
| 571  | GreenCarp            | 7    | 0    | 6   | 15     | -1500    | 100   | -1    | 0     | 31    | 0   |
| 572  | GoldCarp             | 7    | 0    | 6   | 16     | -3000    | 100   | -1    | 0     | 31    | 0   |
| 573  | CrucianCarp          | 7    | 0    | 6   | 12     | -200     | 30    | -1    | 0     | 31    | 0   |
| 574  | BlueSeaBream         | 7    | 0    | 6   | 84     | -2000    | 80    | -1    | 0     | 31    | 0   |
| 575  | Salmon               | 7    | 0    | 6   | 85     | -800     | 50    | -1    | 0     | 31    | 0   |
| 576  | RedSeaBream          | 7    | 0    | 6   | 86     | -2000    | 80    | -1    | 0     | 31    | 0   |
| 577  | GrayMullet           | 7    | 0    | 6   | 87     | -500     | 50    | -1    | 0     | 31    | 0   |
| 580  | BattleAxe+1          | 1    | 9    | 15  | 6      | 6000     | 9000  | 26    | 13    | 1     | 0   |
| 581  | BattleAxe+2          | 1    | 9    | 15  | 6      | -48000   | 9000  | 26    | 13    | 1     | 0   |
| 582  | Sabre+2              | 1    | 8    | 1   | 3      | -2400    | 1200  | 4     | 5     | 1     | 0   |
| 590  | Robe(M)              | 1    | 2    | 9   | 5      | 2000     | 1000  | 6     | 0     | 11    | 0   |
| 591  | Robe(W)              | 1    | 2    | 13  | 6      | 2000     | 1000  | 7     | 0     | 11    | 0   |
| 600  | Helm(M)              | 1    | 1    | 21  | 0      | 800      | 5200  | 4     | 0     | 6     | 0   |
| 601  | FullHelm(M)          | 1    | 1    | 21  | 1      | 1500     | 8500  | 1     | 0     | 6     | 0   |
| 602  | Helm(W)              | 1    | 1    | 21  | 0      | 800      | 5200  | 4     | 0     | 6     | 0   |
| 603  | FullHelm(W)          | 1    | 1    | 21  | 1      | 1500     | 8500  | 1     | 0     | 6     | 0   |
| 610  | XelimaBlade          | 1    | 9    | 1   | 13     | -31000   | 12000 | 11    | 11    | 1     | 0   |
| 611  | XelimaAxe            | 1    | 9    | 1   | 12     | -31000   | 12000 | 26    | 13    | 1     | 0   |
| 612  | XelimaRapier         | 1    | 8    | 1   | 14     | -25000   | 1100  | 7     | 3     | 1     | 0   |
| 613  | SwordofMedusa        | 1    | 9    | 1   | 16     | -31000   | 10000 | 11    | 10    | 1     | 0   |
| 614  | SwordofIceElemental  | 1    | 9    | 1   | 15     | -31000   | 10000 | 11    | 10    | 1     | 0   |
| 615  | GiantSword           | 1    | 9    | 1   | 18     | 8000     | 13000 | 13    | 12    | 1     | 0   |
| 616  | DemonSlayer          | 1    | 9    | 1   | 17     | -25000   | 12000 | 13    | 12    | 1     | 9   |
| 617  | CompositeBow         | 1    | 9    | 2   | 2      | 3000     | 4000  | 41    | 5     | 3     | 0   |
| 618  | DarkElfBow           | 1    | 9    | 2   | 3      | -8000    | 8000  | 40    | 4     | 3     | 0   |
| 620  | MerienShield         | 1    | 7    | 3   | 9      | -45000   | 4000  | 9     | 0     | 5     | 0   |
| 621  | MerienPlateMailM     | 1    | 2    | 9   | 3      | -45000   | 10000 | 4     | 0     | 6     | 5   |
| 622  | MerienPlateMailW     | 1    | 2    | 13  | 5      | -45000   | 10000 | 6     | 0     | 6     | 5   |
| 623  | GM-Shield            | 1    | 7    | 3   | 7      | -1000    | 1000  | 8     | 0     | 5     | 0   |
| 630  | RingoftheXelima      | 1    | 10   | 16  | 25     | -10000   | 500   | -1    | 0     | 46    | 0   |
| 631  | RingoftheAbaddon     | 1    | 10   | 16  | 26     | -19000   | 500   | -1    | 0     | 46    | 0   |
| 632  | RingofOgrepower      | 1    | 10   | 16  | 29     | -10000   | 500   | -1    | 0     | 46    | 0   |
| 633  | RingofDemonpower     | 1    | 10   | 16  | 28     | -10000   | 500   | -1    | 0     | 46    | 0   |
| 634  | RingofWizard         | 1    | 10   | 16  | 30     | -10000   | 500   | -1    | 0     | 46    | 0   |
| 635  | RingofMage           | 1    | 10   | 16  | 31     | -10000   | 500   | -1    | 0     | 46    | 0   |
| 636  | RingofGrandMage      | 1    | 10   | 16  | 32     | -10000   | 500   | -1    | 0     | 46    | 0   |
| 637  | KnecklaceOfLightPro  | 1    | 6    | 16  | 33     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 638  | KnecklaceOfFirePro   | 1    | 6    | 16  | 34     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 639  | KnecklaceOfPoisonPro | 1    | 6    | 16  | 35     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 640  | KnecklaceOfSufferent | 1    | 6    | 16  | 36     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 641  | KnecklaceOfMedusa    | 1    | 6    | 16  | 36     | -20000   | 1000  | -1    | 0     | 46    | 5   |
| 642  | KnecklaceOfIcePro    | 1    | 6    | 16  | 37     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 643  | KnecklaceOfIceEle    | 1    | 6    | 16  | 38     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 644  | KnecklaceOfAirEle    | 1    | 6    | 16  | 40     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 645  | KnecklaceOfEfreet    | 1    | 6    | 16  | 41     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 646  | NecklaceOfBeholder   | 1    | 6    | 16  | 47     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 647  | NecklaceOfStoneGol   | 1    | 6    | 16  | 48     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 648  | NecklaceOfLiche      | 1    | 6    | 16  | 51     | -10000   | 600   | -1    | 0     | 46    | 0   |
| 650  | ZemstoneofSacrifice  | 0    | 0    | 16  | 39     | -5000    | 5000  | -1    | 0     | 0     | 0   |
| 651  | GreenBall            | 0    | 0    | 6   | 123    | -5000    | 4000  | -1    | 0     | 31    | 0   |
| 652  | RedBall              | 0    | 0    | 6   | 124    | -5000    | 4000  | -1    | 0     | 31    | 0   |
| 653  | YellowBall           | 0    | 0    | 6   | 125    | -5000    | 4000  | -1    | 0     | 31    | 0   |
| 654  | BlueBall             | 0    | 0    | 6   | 126    | -5000    | 4000  | -1    | 0     | 31    | 0   |
| 655  | PearlBall            | 0    | 0    | 6   | 127    | -5000    | 4000  | -1    | 0     | 31    | 0   |
| 656  | StoneOfXelima        | 0    | 0    | 6   | 128    | -10000   | 4000  | -1    | 0     | 31    | 0   |
| 657  | StoneOfMerien        | 0    | 0    | 6   | 129    | -10000   | 4000  | -1    | 0     | 31    | 0   |
| 658  | AresdenMinePotion    | 7    | 0    | 6   | 1      | 10       | 30    | -1    | 0     | 21    | 0   |
| 659  | ElvineMinePotion     | 7    | 0    | 6   | 1      | 10       | 30    | -1    | 0     | 21    | 0   |
| 660  | UnfreezePotion       | 7    | 0    | 6   | 130    | -200     | 50    | -1    | 0     | 21    | 0   |
| 671  | KnightRapier         | 1    | 8    | 1   | 6      | 3200     | 1200  | 7     | 3     | 1     | 11  |
| 672  | KnightGreatSword     | 1    | 9    | 1   | 10     | 3500     | 5200  | 11    | 8     | 1     | 11  |
| 673  | KnightFlameberge     | 1    | 9    | 1   | 11     | 3700     | 6000  | 12    | 10    | 1     | 11  |
| 674  | KnightWarAxe         | 1    | 8    | 15  | 1      | 3000     | 4400  | 21    | 8     | 1     | 11  |
| 675  | KnightPlateMail(M)   | 1    | 2    | 9   | 3      | 6000     | 10000 | 4     | 0     | 6     | 11  |
| 676  | KnightPlateMail(W)   | 1    | 2    | 13  | 5      | 6000     | 10000 | 6     | 0     | 6     | 11  |
| 677  | KnightPlateLeg(M)    | 1    | 4    | 8   | 3      | 3000     | 2000  | 4     | 0     | 6     | 11  |
| 678  | KnightPlateLeg(W)    | 1    | 4    | 12  | 4      | 3000     | 2000  | 5     | 0     | 6     | 11  |
| 679  | KnightFullHelm(M)    | 1    | 1    | 21  | 1      | 3500     | 8500  | 1     | 0     | 6     | 11  |
| 680  | KnightFullHelm(W)    | 1    | 1    | 21  | 1      | 3500     | 8500  | 1     | 0     | 6     | 11  |
| 681  | WizardHauberk(M)     | 1    | 3    | 7   | 1      | 2400     | 1200  | 2     | 0     | 6     | 11  |
| 682  | WizardHauberk(W)     | 1    | 3    | 11  | 2      | 2400     | 1200  | 3     | 0     | 6     | 11  |
| 683  | WizMagicWand(MS20)   | 1    | 8    | 17  | 1      | 6000     | 1000  | 36    | 3     | 8     | 4   |
| 684  | WizMagicWand(MS10)   | 1    | 8    | 17  | 1      | 5500     | 1000  | 36    | 3     | 8     | 4   |
| 685  | WizardRobe(M)        | 1    | 2    | 9   | 5      | 3000     | 1000  | 6     | 0     | 13    | 11  |
| 686  | WizardRobe(W)        | 1    | 2    | 13  | 6      | 3000     | 1000  | 7     | 0     | 13    | 11  |
| 687  | KnightHauberk(M)     | 1    | 3    | 7   | 1      | 2400     | 1200  | 2     | 0     | 6     | 11  |
| 688  | KnightHauberk(W)     | 1    | 3    | 11  | 2      | 2400     | 1200  | 3     | 0     | 6     | 11  |
| 700  | SangAhHauberk        | 1    | 3    | 7   | 1      | -2400    | 1200  | 2     | 0     | 6     | 6   |
| 701  | SangAhFullHel        | 1    | 1    | 21  | 1      | -3500    | 8500  | 1     | 0     | 6     | 6   |
| 702  | SangAhLeggings       | 1    | 4    | 8   | 3      | -3000    | 2000  | 4     | 0     | 6     | 6   |
| 703  | SangAhFlameberge     | 1    | 9    | 1   | 11     | -3700    | 6000  | 12    | 10    | 1     | 6   |
| 704  | SangAhPlateMail      | 1    | 2    | 9   | 3      | -1000    | 10000 | 4     | 0     | 6     | 6   |
| 705  | SangAhJewel          | 5    | 0    | 16  | 42     | -5000    | 200   | 1     | 0     | 46    | 0   |
| 706  | DarkKnightHauberk    | 1    | 3    | 7   | 1      | -2400    | 1200  | 2     | 0     | 6     | 6   |
| 707  | DarkKnightFullHelm   | 1    | 1    | 21  | 1      | -3500    | 8500  | 1     | 0     | 6     | 6   |
| 708  | DarkKnightLeggings   | 1    | 4    | 8   | 3      | -3000    | 2000  | 4     | 0     | 6     | 6   |
| 709  | DarkKnightFlameberge | 1    | 9    | 1   | 11     | -3700    | 6000  | 12    | 10    | 1     | 6   |
| 710  | DarkKnightPlateMail  | 1    | 2    | 9   | 3      | -6000    | 10000 | 4     | 0     | 6     | 6   |
| 711  | DarkMageHauberk      | 1    | 3    | 7   | 1      | -2400    | 1200  | 2     | 0     | 6     | 6   |
| 712  | DarkMageChainMail    | 1    | 2    | 9   | 1      | -1200    | 3000  | 2     | 0     | 6     | 6   |
| 713  | DarkMageLeggings     | 1    | 4    | 8   | 3      | -3000    | 2000  | 4     | 0     | 6     | 6   |
| 714  | DarkMageMagicStaff   | 1    | 8    | 17  | 1      | -6000    | 1000  | 36    | 3     | 8     | 6   |
| 715  | DarkMageRobe         | 1    | 2    | 9   | 5      | -2000    | 1000  | 6     | 0     | 11    | 6   |
| 716  | DarkMageLedderArmor  | 1    | 2    | 9   | 0      | -2000    | 1500  | 1     | 0     | 6     | 6   |
| 717  | DarkKnightRapier     | 1    | 8    | 1   | 6      | -3000    | 1100  | 7     | 3     | 1     | 6   |
| 718  | DarkKnightGreatSword | 1    | 9    | 1   | 10     | -3000    | 5200  | 11    | 8     | 1     | 6   |
| 719  | DarkMageScaleMail    | 1    | 2    | 9   | 2      | -1000    | 2000  | 3     | 0     | 6     | 6   |
| 720  | Songpyon             | 7    | 0    | 6   | 115    | -2400    | 20    | -1    | 0     | 21    | 0   |
| 721  | Ginseng              | 7    | 0    | 6   | 114    | -600     | 50    | -1    | 0     | 21    | 0   |
| 722  | BeefRibSet           | 0    | 0    | 6   | 116    | -50000   | 5000  | -1    | 0     | 0     | 0   |
| 723  | Wine                 | 0    | 0    | 6   | 117    | -25000   | 250   | -1    | 0     | 0     | 0   |
| 724  | DarkKnightHauberkW   | 1    | 3    | 11  | 2      | -2400    | 1200  | 3     | 0     | 6     | 6   |
| 725  | DarkKnightFullHelmW  | 1    | 1    | 21  | 1      | -3500    | 8500  | 1     | 0     | 6     | 6   |
| 726  | DarkKnightLeggingsW  | 1    | 4    | 12  | 4      | -3000    | 2000  | 5     | 0     | 6     | 6   |
| 727  | DarkKnightFlamebergW | 1    | 9    | 1   | 11     | -3700    | 6000  | 12    | 10    | 1     | 6   |
| 728  | DarkKnightPlateMailW | 1    | 2    | 13  | 5      | -6000    | 10000 | 6     | 0     | 6     | 6   |
| 729  | DarkMageHauberkW     | 1    | 3    | 11  | 2      | -2400    | 1200  | 3     | 0     | 6     | 6   |
| 730  | DarkMageChainMailW   | 1    | 2    | 13  | 3      | -1200    | 3000  | 4     | 0     | 6     | 6   |
| 731  | DarkMageLeggingsW    | 1    | 4    | 12  | 4      | -3000    | 2000  | 5     | 0     | 6     | 6   |
| 732  | DarkMageMagicStaffW  | 1    | 8    | 17  | 1      | -6000    | 1000  | 36    | 3     | 8     | 6   |
| 733  | DarkMageRobeW        | 1    | 2    | 13  | 6      | -2000    | 1000  | 7     | 0     | 11    | 6   |
| 734  | RingofArcmage        | 1    | 10   | 16  | 49     | -10000   | 500   | -1    | 0     | 46    | 0   |
| 735  | RingofDragonpower    | 1    | 10   | 16  | 50     | -10000   | 500   | -1    | 0     | 46    | 0   |
| 736  | SangAhGiantSword     | 1    | 9    | 1   | 18     | -3700    | 6000  | 13    | 10    | 1     | 6   |
| 737  | DarkKnightGiantSword | 1    | 9    | 1   | 18     | -3700    | 6000  | 13    | 10    | 1     | 6   |
| 738  | DarkMageMagicWand    | 1    | 8    | 17  | 0      | -6000    | 1000  | 35    | 3     | 8     | 6   |
| 740  | 5000GoldPocket       | 0    | 0    | 6   | 118    | -10000   | 500   | -1    | 0     | 21    | 0   |
| 741  | 10000GoldPocket      | 0    | 0    | 6   | 119    | -20000   | 1000  | -1    | 0     | 21    | 0   |
| 742  | 50000GoldPocket      | 0    | 0    | 6   | 120    | -100000  | 2000  | -1    | 0     | 21    | 0   |
| 743  | 100000GoldPocket     | 0    | 0    | 6   | 121    | -200000  | 3000  | -1    | 0     | 21    | 0   |
| 744  | 1000000GoldPocket    | 0    | 0    | 6   | 122    | -2000000 | 4000  | -1    | 0     | 21    | 0   |
| 745  | BlackKnightTemple    | 1    | 9    | 1   | 20     | -3700    | 6000  | 14    | 10    | 1     | 6   |
| 746  | BlackMageTemple      | 1    | 8    | 17  | 2      | -6000    | 1000  | 37    | 3     | 8     | 6   |
| 750  | Horned-Helm(M)       | 1    | 1    | 21  | 2      | 4000     | 16000 | 5     | 0     | 6     | 0   |
| 751  | Wings-Helm(M)        | 1    | 1    | 21  | 3      | 5000     | 13000 | 6     | 0     | 6     | 0   |
| 752  | Wizard-Cap(M)        | 1    | 1    | 21  | 4      | 1500     | 1500  | 7     | 0     | 6     | 0   |
| 753  | Wizard-Hat(M)        | 1    | 1    | 21  | 5      | 3000     | 1500  | 8     | 0     | 6     | 0   |
| 754  | Horned-Helm(W)       | 1    | 1    | 21  | 2      | 4000     | 16000 | 5     | 0     | 6     | 0   |
| 755  | Wings-Helm(W)        | 1    | 1    | 21  | 3      | 5000     | 13000 | 6     | 0     | 6     | 0   |
| 756  | Wizard-Cap(W)        | 1    | 1    | 21  | 4      | 1500     | 1500  | 7     | 0     | 6     | 0   |
| 757  | Wizard-Hat(W)        | 1    | 1    | 21  | 5      | 3000     | 1500  | 8     | 0     | 6     | 0   |
| 760  | Hammer               | 1    | 9    | 15  | 7      | 6000     | 9000  | 30    | 12    | 1     | 0   |
| 761  | BattleHammer         | 1    | 9    | 15  | 8      | 9000     | 12000 | 31    | 14    | 1     | 0   |
| 762  | GiantBattleHammer    | 1    | 9    | 15  | 8      | -15000   | 14000 | 31    | 14    | 1     | 9   |
| 765  | ThirdMemorialRing    | 1    | 10   | 16  | 11     | -1000    | 200   | -1    | 0     | 46    | 0   |
| 770  | SantaCostume(M)      | 1    | 13   | 9   | 6      | -18000   | 1000  | 7     | 0     | 15    | 0   |
| 771  | SantaCostume(W)      | 1    | 13   | 13  | 7      | -18000   | 1000  | 8     | 0     | 15    | 0   |
| 780  | RedCandy             | 7    | 0    | 6   | 131    | -2000    | 100   | -1    | 0     | 21    | 0   |
| 781  | BlueCandy            | 7    | 0    | 6   | 132    | -2000    | 100   | -1    | 0     | 21    | 0   |
| 782  | GreenCandy           | 7    | 0    | 6   | 133    | -2000    | 100   | -1    | 0     | 21    | 0   |
| 800  | FarmingManual        | 3    | 0    | 6   | 92     | 100      | 1     | -1    | 0     | 42    | 0   |
| 801  | SeedBag(WaterMelon)  | 11   | 0    | 6   | 137    | 100      | 100   | -1    | 0     | 21    | 0   |
| 802  | SeedBag(Pumpkin)     | 11   | 0    | 6   | 137    | 100      | 100   | -1    | 0     | 21    | 0   |
| 803  | SeedBag(Garlic)      | 11   | 0    | 6   | 137    | 150      | 100   | -1    | 0     | 21    | 0   |
| 804  | SeedBag(Barley)      | 11   | 0    | 6   | 137    | 150      | 100   | -1    | 0     | 21    | 0   |
| 805  | SeedBag(Carrot)      | 11   | 0    | 6   | 137    | 200      | 100   | -1    | 0     | 21    | 0   |
| 806  | SeedBag(Radish)      | 11   | 0    | 6   | 137    | 200      | 100   | -1    | 0     | 21    | 0   |
| 807  | SeedBag(Corn)        | 11   | 0    | 6   | 137    | 250      | 100   | -1    | 0     | 21    | 0   |
| 808  | SeedBag(CBellflower) | 11   | 0    | 6   | 137    | 250      | 100   | -1    | 0     | 21    | 0   |
| 809  | SeedBag(Melone)      | 11   | 0    | 6   | 137    | 300      | 100   | -1    | 0     | 21    | 0   |
| 810  | SeedBag(Tommato)     | 11   | 0    | 6   | 137    | 300      | 100   | -1    | 0     | 21    | 0   |
| 811  | SeedBag(Grapes)      | 11   | 0    | 6   | 137    | 350      | 100   | -1    | 0     | 21    | 0   |
| 812  | SeedBag(BlueGrapes)  | 11   | 0    | 6   | 137    | 350      | 100   | -1    | 0     | 21    | 0   |
| 813  | SeedBag(Mushroom)    | 11   | 0    | 6   | 137    | 400      | 100   | -1    | 0     | 21    | 0   |
| 814  | SeedBag(Ginseng)     | 11   | 0    | 6   | 137    | 450      | 100   | -1    | 0     | 21    | 0   |
| 820  | WaterMelon           | 5    | 0    | 6   | 138    | -120     | 100   | 1     | 0     | 31    | 0   |
| 821  | Pumpkin              | 5    | 0    | 6   | 139    | -120     | 100   | 1     | 0     | 31    | 0   |
| 822  | Garlic               | 5    | 0    | 6   | 140    | -180     | 100   | 1     | 0     | 31    | 0   |
| 823  | Barley               | 5    | 0    | 6   | 141    | -180     | 100   | 1     | 0     | 31    | 0   |
| 824  | Carrot               | 5    | 0    | 6   | 142    | -200     | 100   | 1     | 0     | 31    | 0   |
| 825  | Radish               | 5    | 0    | 6   | 143    | -200     | 100   | 1     | 0     | 31    | 0   |
| 826  | Corn                 | 7    | 0    | 6   | 144    | -240     | 100   | -1    | 0     | 31    | 0   |
| 827  | ChineseBellflower    | 5    | 0    | 6   | 145    | -240     | 100   | 1     | 0     | 31    | 0   |
| 828  | Melone               | 7    | 0    | 6   | 146    | -300     | 100   | -1    | 0     | 31    | 0   |
| 829  | Tommato              | 7    | 0    | 6   | 147    | -300     | 100   | -1    | 0     | 31    | 0   |
| 830  | Grapes               | 7    | 0    | 6   | 148    | -360     | 100   | -1    | 0     | 31    | 0   |
| 831  | BlueGrapes           | 7    | 0    | 6   | 149    | -360     | 100   | -1    | 0     | 31    | 0   |
| 832  | Mushroom             | 5    | 0    | 6   | 150    | -400     | 100   | 1     | 0     | 31    | 0   |
| 840  | SuperRedPotion       | 7    | 0    | 6   | 134    | -2000    | 100   | -1    | 0     | 21    | 0   |
| 841  | SuperBluePotion      | 7    | 0    | 6   | 135    | -2000    | 100   | -1    | 0     | 21    | 0   |
| 842  | SuperGreenPotion     | 7    | 0    | 6   | 136    | -2000    | 100   | -1    | 0     | 21    | 0   |
| 843  | BarbarianHammer      | 1    | 9    | 15  | 10     | 15000    | 20000 | 32    | 15    | 1     | 0   |
| 844  | BlackShadowSword     | 1    | 9    | 1   | 25     | 10000    | 15000 | 33    | 14    | 1     | 0   |
| 845  | StormBringer         | 1    | 9    | 1   | 26     | -12000   | 11000 | 15    | 11    | 1     | 0   |
| 846  | The_Devastator       | 1    | 9    | 1   | 21     | -18000   | 20000 | 19    | 15    | 1     | 0   |
| 847  | DarkExecutor         | 1    | 9    | 1   | 24     | -14000   | 14000 | 16    | 13    | 1     | 0   |
| 848  | LightingBlade        | 1    | 9    | 1   | 22     | -14000   | 14000 | 29    | 13    | 1     | 0   |
| 849  | KlonessBlade         | 1    | 9    | 1   | 23     | -12000   | 12000 | 17    | 12    | 1     | 0   |
| 850  | KlonessAxe           | 1    | 9    | 15  | 11     | -8000    | 15000 | 28    | 14    | 1     | 0   |
| 851  | KlonessEsterk        | 1    | 8    | 1   | 27     | -6000    | 5000  | 18    | 5     | 1     | 0   |
| 852  | CancelManual         | 3    | 0    | 6   | 91     | -100     | 1     | -1    | 0     | 42    | 1   |
| 853  | E.S.W.Manual         | 3    | 0    | 6   | 91     | -100     | 1     | -1    | 0     | 42    | 1   |
| 857  | I.M.CManual          | 3    | 0    | 6   | 91     | -100     | 1     | -1    | 0     | 42    | 1   |
| 858  | NecklaceOfMerien     | 1    | 6    | 16  | 54     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 859  | NecklaceOfKloness    | 1    | 6    | 16  | 52     | -20000   | 1000  | -1    | 0     | 46    | 0   |
| 860  | NecklaceOfXelima     | 1    | 6    | 16  | 53     | -20000   | 1000  | -1    | 0     | 46    | 5   |
| 861  | BerserkWand(MS.20)   | 1    | 8    | 17  | 4      | -12000   | 1000  | 34    | 3     | 8     | 0   |
| 862  | BerserkWand(MS.10)   | 1    | 8    | 17  | 4      | -12000   | 1000  | 34    | 3     | 8     | 0   |
| 863  | KlonessWand(MS.20)   | 1    | 8    | 17  | 5      | -14000   | 1000  | 39    | 3     | 8     | 0   |
| 864  | KlonessWand(MS.10)   | 1    | 8    | 17  | 5      | -14000   | 1000  | 39    | 3     | 8     | 0   |
| 865  | ResurWand(MS.20)     | 1    | 8    | 17  | 3      | -10000   | 1000  | 38    | 3     | 8     | 0   |
| 866  | ResurWand(MS.10)     | 1    | 8    | 17  | 3      | -10000   | 1000  | 38    | 3     | 8     | 0   |
| 867  | AcientTablet         | 3    | 0    | 6   | 155    | -1       | 50    | -1    | 0     | 31    | 0   |
| 868  | AcientTablet(LU)     | 10   | 0    | 6   | 151    | -1       | 50    | -1    | 0     | 31    | 0   |
| 869  | AcientTablet(LD)     | 10   | 0    | 6   | 152    | -1       | 50    | -1    | 0     | 31    | 0   |
| 870  | AcientTablet(RU)     | 10   | 0    | 6   | 153    | -1       | 50    | -1    | 0     | 31    | 0   |
| 871  | AcientTablet(RD)     | 10   | 0    | 6   | 154    | -1       | 50    | -1    | 0     | 31    | 0   |
| 873  | Fire-Bow             | 1    | 9    | 2   | 5      | 6000     | 7000  | 43    | 6     | 3     | 0   |
| 874  | Direction-Bow        | 1    | 9    | 2   | 4      | 7000     | 10000 | 42    | 8     | 3     | 0   |
| 875  | SummonScroll(SOR)    | 3    | 0    | 6   | 9      | -300     | 1     | -1    | 0     | 42    | 0   |
| 876  | SummonScroll(ATK)    | 3    | 0    | 6   | 9      | -300     | 1     | -1    | 0     | 42    | 0   |
| 877  | SummonScroll(ELF)    | 3    | 0    | 6   | 9      | -300     | 1     | -1    | 0     | 42    | 0   |
| 878  | SummonScroll(DSK)    | 3    | 0    | 6   | 9      | -300     | 1     | -1    | 0     | 42    | 0   |
| 879  | SummonScroll(HBT)    | 3    | 0    | 6   | 9      | -300     | 1     | -1    | 0     | 42    | 0   |
| 880  | SummonScroll(BAR)    | 3    | 0    | 6   | 9      | -300     | 1     | -1    | 0     | 42    | 0   |
| 881  | ArmorDye(Indigo)     | 11   | 0    | 6   | 58     | -100     | 1     | -1    | 0     | 42    | 0   |
| 882  | ArmorDye(CrimsonRed)+ | 11   | 0    | 6   | 61     | -100     | 1     | -1    | 0     | 42    | 0   |
| 883  | ArmorDye(Gold)+       | 11   | 0    | 6   | 60     | -100     | 1     | -1    | 0     | 42    | 0   |
| 884  | ArmorDye(Aqua)+       | 11   | 0    | 6   | 54     | -100     | 1     | -1    | 0     | 42    | 0   |
| 885  | ArmorDye(Pink)+       | 11   | 0    | 6   | 65     | -100     | 1     | -1    | 0     | 42    | 0   |
| 886  | ArmorDye(Violet)     | 11   | 0    | 6   | 66     | -100     | 1     | -1    | 0     | 42    | 0   |
| 887  | ArmorDye(Blue)       | 11   | 0    | 6   | 67     | -100     | 1     | -1    | 0     | 42    | 0   |
| 888  | ArmorDye(Khaki)      | 11   | 0    | 6   | 69     | -100     | 1     | -1    | 0     | 42    | 0   |
| 889  | ArmorDye(Yellow)     | 11   | 0    | 6   | 70     | -100     | 1     | -1    | 0     | 42    | 0   |
| 890  | ArmorDye(Red)        | 11   | 0    | 6   | 71     | -100     | 1     | -1    | 0     | 42    | 0   |
| 1081 | MaginDiamond         | 1    | 11   | 22  | 6      | -8000    | 200   | -1    | 0     | 46    | 9   |
| 1082 | MaginRuby            | 1    | 11   | 22  | 8      | -5000    | 200   | -1    | 0     | 46    | 9   |
| 1083 | MagicEmerald         | 1    | 11   | 22  | 7      | -5000    | 200   | -1    | 0     | 46    | 9   |
| 1084 | MagicSapphire        | 1    | 11   | 22  | 9      | -5000    | 200   | -1    | 0     | 46    | 9   |
| 1085 | LuckyPrizeTicket     | 3    | 0    | 6   | 9      | 50000    | 1     | -1    | 0     | 42    | 0   |
| 1086 | MagicNecklace(DF+15) | 1    | 6    | 16  | 6      | -19000   | 400   | -1    | 0     | 46    | 0   |
| 1087 | MagicNecklace(DF+20) | 1    | 6    | 16  | 6      | -19000   | 400   | -1    | 0     | 46    | 0   |
| 1088 | MagicNecklace(DF+25) | 1    | 6    | 16  | 6      | -19000   | 400   | -1    | 0     | 46    | 0   |
| 1089 | MagicNecklace(DF+30) | 1    | 6    | 16  | 6      | -19000   | 400   | -1    | 0     | 46    | 0   |
| 1090 | MagicNecklace(DM+2)  | 1    | 6    | 16  | 5      | -39800   | 400   | -1    | 0     | 46    | 0   |
| 1091 | MagicNecklace(DM+3)  | 1    | 6    | 16  | 5      | -39800   | 400   | -1    | 0     | 46    | 0   |
| 1092 | MagicNecklace(DM+4)  | 1    | 6    | 16  | 5      | -39800   | 400   | -1    | 0     | 46    | 0   |
| 1093 | MagicNecklace(DM+5)  | 1    | 6    | 16  | 5      | -39800   | 400   | -1    | 0     | 46    | 0   |
| 1094 | MagicNecklace(MS12)  | 1    | 6    | 16  | 7      | -7000    | 400   | -1    | 0     | 46    | 0   |
| 1095 | MagicNecklace(MS14)  | 1    | 6    | 16  | 7      | -7000    | 400   | -1    | 0     | 46    | 0   |
| 1096 | MagicNecklace(MS16)  | 1    | 6    | 16  | 7      | -7000    | 400   | -1    | 0     | 46    | 0   |
| 1097 | MagicNecklace(MS18)  | 1    | 6    | 16  | 7      | -7000    | 400   | -1    | 0     | 46    | 0   |
| 1098 | MagicNecklace(RM15)  | 1    | 6    | 16  | 4      | -2250    | 400   | -1    | 0     | 46    | 0   |
| 1099 | MagicNecklace(RM20)  | 1    | 6    | 16  | 4      | -2250    | 400   | -1    | 0     | 46    | 0   |
| 1100 | MagicNecklace(RM25)  | 1    | 6    | 16  | 4      | -2250    | 400   | -1    | 0     | 46    | 0   |
| 1101 | MagicNecklace(RM30)  | 1    | 6    | 16  | 4      | -2250    | 400   | -1    | 0     | 46    | 0   |
| 1102 | DiamondWare          | 12   | 0    | 22  | 1      | -5000    | 200   | 1     | 0     | 46    | 0   |
| 1103 | RubyWare             | 12   | 0    | 22  | 3      | -3000    | 200   | 1     | 0     | 46    | 0   |
| 1104 | SapphireWare         | 12   | 0    | 22  | 4      | -3000    | 200   | 1     | 0     | 46    | 0   |
| 1105 | EmeraldWare          | 12   | 0    | 22  | 2      | -3000    | 200   | 1     | 0     | 46    | 0   |
| 1106 | CrystalWare          | 12   | 0    | 22  | 5      | -500     | 200   | 1     | 0     | 46    | 0   |
| 1107 | CraftingVessel       | 10   | 0    | 22  | 0      | -1000    | 700   | -1    | 0     | 21    | 0   |
| 1108 | AngelicPandent(STR)  | 1    | 11   | 22  | 11     | -3000    | 200   | -1    | 0     | 46    | 6   |
| 1109 | AngelicPandent(DEX)  | 1    | 11   | 22  | 10     | -3000    | 200   | -1    | 0     | 46    | 6   |
| 1110 | AngelicPandent(INT)  | 1    | 11   | 22  | 12     | -3000    | 200   | -1    | 0     | 46    | 6   |
| 1111 | AngelicPandent(MAG)  | 1    | 11   | 22  | 13     | -3000    | 200   | -1    | 0     | 46    | 6   |


---

## 7. Data Flow

1. **Item.cfg / Item2.cfg / Item3.cfg:** Each item has `Spr`, `SFrame`, `ApprV`.
2. **Server:** On equip, stores `m_cApprValue` and packs it into `sAppr1`–`sAppr4` by slot.
3. **Client:** Receives appearance packet, extracts ApprV per slot, computes sprite index from the formulas above.
4. **Client:** Loads sprites from the corresponding .pak files during loading (Client.cpp cases 48–100).
5. **Client:** Draws character with `m_pSprite[spriteIndex]->PutSprite(...)` using the computed index and animation frame.

