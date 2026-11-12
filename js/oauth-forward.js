// Google sign-in can land on the landing page instead of the game page: send it straight on to the game.
(function () { var q = location.search + location.hash; if (/[?&#](code|access_token|error_description)=/.test(q)) location.replace('play/' + location.search + location.hash); })();
