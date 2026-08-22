ALTER TABLE artifact_versions
DROP CONSTRAINT artifact_versions_unique_version;

ALTER TABLE artifact_versions
ADD CONSTRAINT artifact_versions_unique_version UNIQUE (artifact_id, branch_name, version_number);
