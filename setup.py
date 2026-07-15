from setuptools import find_packages, setup
setup(name="ai_assistant", version="1.0.0",
      description="Global AI assistant chat bubble for Frappe Desk.",
      author="RySS / Common Ground Initiative", packages=find_packages(),
      include_package_data=True, zip_safe=False, python_requires=">=3.10")
