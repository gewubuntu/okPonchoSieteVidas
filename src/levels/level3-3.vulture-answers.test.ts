import { describe, expect, it } from 'vitest';
import { waitAndAnswer } from './level3-3.drive';

// GDD-WLD-18, phase V2: K3's answers with the Zopilote 108 px over P5 at its lowest, centred on x = 3024 (its sight x 2880 to 3168), over every ANSWER_STEPth
// clock, alone in this file (vitest runs the 3-3 files in parallel; the take-offs are every step of each answer's window, never coarsened).

const ANSWER_STEP = 96;

describe('GDD-WLD-18 level 3-3 K3 and the Zopilote, the GDD answers: wait before the vulture, let K3 come, answer it, then stand or walk on', () => {
  it('GDD-WLD-18 3-3 K3 and the vulture: waiting where K3 wakes, every answer at K3 buffer, then standing till the vulture cruises and walking on to A, at every 96th clock (step 96, 75 clocks)', () => {
    // Measured, GDD-WLD-18 "the cart is met before the vulture's stretch (wait and jump it there)", waiting where K3 wakes (x = 2962), at every 96th clock
    // (75 of the 1,200). K3's own window of each answer (a copy without the vulture): the jump over 38 steps held and 16 plain, the stomp 12 and 10, a landing in its cart
    // behind the ringtail 4 and 6, the claw 12. `atK3Buffer` is the old pin, renamed: the drive of an answer ends 20 steps after K3's cart parks at its
    // buffer, which is before the dive the jump set off has landed, so it says only that the take-off lives to K3's pass. `follow` is what keeps the
    // life: every take-off that lives is followed on (a) standing until the Zopilote cruises again (COOL_STEPS, one step), 600 at most, and (b) right held on to
    // A, 600 at most; `kept` counts take-offs whose life holds to the end, `clocks` the clocks where some take-off keeps it, `lostTo` the others by
    // cause (`onA` and `short`: a kept walk ends on A, or alive short of it when the 600 steps are over).
    // At K3's buffer: no wait is lost; every answer lives at all 75 clocks except the stomps (a jump under it, seen): the held stomp lives at none (900
    // take-offs lost to the vulture) and the plain stomp at 70 (198 lost). Followed on, standing: the held jump over keeps the life at all 75 clocks but
    // loses 576 of its 2,850 take-offs to the vulture; the plain jump over keeps it at 25 clocks only (186 of 1,200 take-offs: the jump sets the vulture
    // off and it dives where he stands); the landing in its cart keeps it at all 75 held (300 of 300) and loses 78 of 450 plain to the vulture; the plain
    // stomp and the claw lose none. Followed on, walking to A: the held jump over keeps it everywhere (2,850; 2,128 on A, 722 short), the plain jump over
    // at 62 clocks (918 of 1,200; the vulture takes 282); the plain stomp and the claw lose none. The landing in its cart loses to K3 at every held
    // take-off (300 of 300) and at 300 of 450 plain ones: it ends in the cart on the buffer side of the parked ringtail (x 2908 to 2916 of its box
    // 2921 to 2935, K3 alive at x 2928), and walking right runs into it within 2 to 9 steps; the 150 plain ones that end right of it (x 2945 to 2948)
    // walk out of the cart and the vulture takes 59 of them (91 kept in all, at 47 clocks).
    expect(waitAndAnswer('wake', ANSWER_STEP)).toEqual({
      "atK3Buffer": {
        "held jump over": {
          "steps": 38,
          "none": 0,
          "some": 75,
          "full": 75,
          "ok": 2850
        },
        "plain jump over": {
          "steps": 16,
          "none": 0,
          "some": 75,
          "full": 75,
          "ok": 1200
        },
        "held jump, stomp": {
          "steps": 12,
          "none": 75,
          "some": 0,
          "full": 0,
          "ok": 0
        },
        "plain jump, stomp": {
          "steps": 10,
          "none": 5,
          "some": 70,
          "full": 44,
          "ok": 552
        },
        "held jump, in its cart": {
          "steps": 4,
          "none": 0,
          "some": 75,
          "full": 75,
          "ok": 300
        },
        "plain jump, in its cart": {
          "steps": 6,
          "none": 0,
          "some": 75,
          "full": 75,
          "ok": 450
        },
        "claw": {
          "steps": 12,
          "none": 0,
          "some": 75,
          "full": 75,
          "ok": 900
        }
      },
      "anyAnswer": 75,
      "waitLost": {},
      "lostAtK3Buffer": {
        "held jump, stomp": {
          "Zopilote": 900
        },
        "plain jump, stomp": {
          "Zopilote": 198
        }
      },
      "follow": {
        "held jump over": {
          "stand": {
            "takeoffs": 2850,
            "kept": 2274,
            "clocks": 75,
            "lostTo": {
              "Zopilote": 576
            },
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 2850,
            "kept": 2850,
            "clocks": 75,
            "lostTo": {},
            "onA": 2128,
            "short": 722
          }
        },
        "plain jump over": {
          "stand": {
            "takeoffs": 1200,
            "kept": 186,
            "clocks": 25,
            "lostTo": {
              "Zopilote": 1014
            },
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 1200,
            "kept": 918,
            "clocks": 62,
            "lostTo": {
              "Zopilote": 282
            },
            "onA": 685,
            "short": 233
          }
        },
        "held jump, stomp": {
          "stand": {
            "takeoffs": 0,
            "kept": 0,
            "clocks": 0,
            "lostTo": {},
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 0,
            "kept": 0,
            "clocks": 0,
            "lostTo": {},
            "onA": 0,
            "short": 0
          }
        },
        "plain jump, stomp": {
          "stand": {
            "takeoffs": 552,
            "kept": 552,
            "clocks": 70,
            "lostTo": {},
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 552,
            "kept": 552,
            "clocks": 70,
            "lostTo": {},
            "onA": 410,
            "short": 142
          }
        },
        "held jump, in its cart": {
          "stand": {
            "takeoffs": 300,
            "kept": 300,
            "clocks": 75,
            "lostTo": {},
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 300,
            "kept": 0,
            "clocks": 0,
            "lostTo": {
              "K3": 300
            },
            "onA": 0,
            "short": 0
          }
        },
        "plain jump, in its cart": {
          "stand": {
            "takeoffs": 450,
            "kept": 372,
            "clocks": 75,
            "lostTo": {
              "Zopilote": 78
            },
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 450,
            "kept": 91,
            "clocks": 47,
            "lostTo": {
              "K3": 300,
              "Zopilote": 59
            },
            "onA": 68,
            "short": 23
          }
        },
        "claw": {
          "stand": {
            "takeoffs": 900,
            "kept": 900,
            "clocks": 75,
            "lostTo": {},
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 900,
            "kept": 900,
            "clocks": 75,
            "lostTo": {},
            "onA": 634,
            "short": 266
          }
        }
      }
    });
  }, 480_000);

  it('GDD-WLD-18 3-3 K3 and the vulture: waiting at the stretch edge, every answer at K3 buffer, then standing till the vulture cruises and walking on to A, at every 96th clock (step 96, 75 clocks)', () => {
    // As above, waiting at x = 2992 (under the vulture's line, x 2976 to 3072), at every 96th clock (75). K3's own window of each answer (a copy without the vulture): the jump over 38 steps held and 16 plain, the stomp 12 and 10, a landing in its cart
    // behind the ringtail 4 and 6, the claw 12. `atK3Buffer` is the old pin, renamed: the drive of an answer ends 20 steps after K3's cart parks at its
    // buffer, which is before the dive the jump set off has landed, so it says only that the take-off lives to K3's pass. `follow` is what keeps the
    // life: every take-off that lives is followed on (a) standing until the Zopilote cruises again (COOL_STEPS, one step), 600 at most, and (b) right held on to
    // A, 600 at most; `kept` counts take-offs whose life holds to the end, `clocks` the clocks where some take-off keeps it, `lostTo` the others by
    // cause (`onA` and `short`: a kept walk ends on A, or alive short of it when the 600 steps are over).
    // At K3's buffer: no wait is lost; the held stomp lives at none (900 take-offs lost), the plain jump over at 75 clocks (49 at every step, 107 take-offs
    // lost to the vulture), the plain stomp at 75 (66; 9 lost), the rest at every step of their windows. Followed on, standing: the plain jump over keeps
    // the life at no clock (all 1,093 take-offs lose it to the vulture), every other answer keeps it at all 75, the held jump over included (2,850 of
    // 2,850). Walking to A: the plain jump over keeps it at 56 clocks (400 of 1,093; the vulture takes 693); the held jump over, the plain stomp and the
    // claw lose none; the landing in its cart loses to K3 at every held take-off (300) and at 300 of 450 plain ones, as at the wake spot (the vulture
    // takes 82 more plain ones).
    expect(waitAndAnswer('edge', ANSWER_STEP)).toEqual({
      "atK3Buffer": {
        "held jump over": {
          "steps": 38,
          "none": 0,
          "some": 75,
          "full": 75,
          "ok": 2850
        },
        "plain jump over": {
          "steps": 16,
          "none": 0,
          "some": 75,
          "full": 49,
          "ok": 1093
        },
        "held jump, stomp": {
          "steps": 12,
          "none": 75,
          "some": 0,
          "full": 0,
          "ok": 0
        },
        "plain jump, stomp": {
          "steps": 10,
          "none": 0,
          "some": 75,
          "full": 66,
          "ok": 741
        },
        "held jump, in its cart": {
          "steps": 4,
          "none": 0,
          "some": 75,
          "full": 75,
          "ok": 300
        },
        "plain jump, in its cart": {
          "steps": 6,
          "none": 0,
          "some": 75,
          "full": 75,
          "ok": 450
        },
        "claw": {
          "steps": 12,
          "none": 0,
          "some": 75,
          "full": 75,
          "ok": 900
        }
      },
      "anyAnswer": 75,
      "waitLost": {},
      "lostAtK3Buffer": {
        "held jump, stomp": {
          "Zopilote": 900
        },
        "plain jump over": {
          "Zopilote": 107
        },
        "plain jump, stomp": {
          "Zopilote": 9
        }
      },
      "follow": {
        "held jump over": {
          "stand": {
            "takeoffs": 2850,
            "kept": 2850,
            "clocks": 75,
            "lostTo": {},
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 2850,
            "kept": 2850,
            "clocks": 75,
            "lostTo": {},
            "onA": 2128,
            "short": 722
          }
        },
        "plain jump over": {
          "stand": {
            "takeoffs": 1093,
            "kept": 0,
            "clocks": 0,
            "lostTo": {
              "Zopilote": 1093
            },
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 1093,
            "kept": 400,
            "clocks": 56,
            "lostTo": {
              "Zopilote": 693
            },
            "onA": 288,
            "short": 112
          }
        },
        "held jump, stomp": {
          "stand": {
            "takeoffs": 0,
            "kept": 0,
            "clocks": 0,
            "lostTo": {},
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 0,
            "kept": 0,
            "clocks": 0,
            "lostTo": {},
            "onA": 0,
            "short": 0
          }
        },
        "plain jump, stomp": {
          "stand": {
            "takeoffs": 741,
            "kept": 741,
            "clocks": 75,
            "lostTo": {},
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 741,
            "kept": 741,
            "clocks": 75,
            "lostTo": {},
            "onA": 553,
            "short": 188
          }
        },
        "held jump, in its cart": {
          "stand": {
            "takeoffs": 300,
            "kept": 300,
            "clocks": 75,
            "lostTo": {},
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 300,
            "kept": 0,
            "clocks": 0,
            "lostTo": {
              "K3": 300
            },
            "onA": 0,
            "short": 0
          }
        },
        "plain jump, in its cart": {
          "stand": {
            "takeoffs": 450,
            "kept": 450,
            "clocks": 75,
            "lostTo": {},
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 450,
            "kept": 68,
            "clocks": 36,
            "lostTo": {
              "K3": 300,
              "Zopilote": 82
            },
            "onA": 49,
            "short": 19
          }
        },
        "claw": {
          "stand": {
            "takeoffs": 900,
            "kept": 900,
            "clocks": 75,
            "lostTo": {},
            "onA": 0,
            "short": 0
          },
          "walk": {
            "takeoffs": 900,
            "kept": 900,
            "clocks": 75,
            "lostTo": {},
            "onA": 672,
            "short": 228
          }
        }
      }
    });
  }, 480_000);
});
