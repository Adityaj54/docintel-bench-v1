import os
import tempfile

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-session-signing-key-never-use-in-production"
os.environ["STORAGE_ROOT"] = tempfile.mkdtemp(prefix="docintel-test-")
os.environ["SEED_ON_REGISTER"] = "false"
