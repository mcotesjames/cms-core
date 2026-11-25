-- The top Studio role is now called "collaborator" (the site's developer), not "owner".
UPDATE `users` SET `role` = 'collaborator' WHERE `role` = 'owner';
